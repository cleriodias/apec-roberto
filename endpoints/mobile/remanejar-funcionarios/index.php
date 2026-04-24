<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/_bootstrap.php';

function table_columns(string $tableName): array
{
    static $cache = [];

    if (array_key_exists($tableName, $cache)) {
        return $cache[$tableName];
    }

    $statement = db()->prepare(
        'select column_name
         from information_schema.columns
         where table_schema = database()
           and table_name = :table_name'
    );
    $statement->execute(['table_name' => $tableName]);

    $cache[$tableName] = array_map(
        static fn (array $row): string => (string) ($row['column_name'] ?? ''),
        $statement->fetchAll()
    );

    return $cache[$tableName];
}

function table_exists(string $tableName): bool
{
    return table_columns($tableName) !== [];
}

function user_activity_conditions(string $alias = 'u'): array
{
    $columns = table_columns('users');
    $conditions = [];

    if (in_array('deleted_at', $columns, true)) {
        $conditions[] = "{$alias}.deleted_at is null";
    }

    foreach (['status', 'ativo', 'is_active', 'active', 'tb3_status'] as $column) {
        if (in_array($column, $columns, true)) {
            $conditions[] = "coalesce({$alias}.{$column}, 1) = 1";
            break;
        }
    }

    return $conditions;
}

function fetch_remanejamento_users(): array
{
    $conditions = user_activity_conditions('u');
    $whereSql = $conditions ? (' where ' . implode(' and ', $conditions)) : '';

    $statement = db()->prepare(
        "select
            u.id,
            u.name,
            u.tb2_id as unit_id,
            unit.tb2_nome as unit_name
         from users u
         left join tb2_unidades unit on unit.tb2_id = u.tb2_id
         {$whereSql}
         order by u.name asc"
    );
    $statement->execute();

    return array_map(static fn (array $row): array => [
        'id' => (int) ($row['id'] ?? 0),
        'name' => (string) ($row['name'] ?? ''),
        'unit_id' => $row['unit_id'] === null ? null : (int) $row['unit_id'],
        'unit_name' => (string) ($row['unit_name'] ?? ''),
    ], $statement->fetchAll());
}

function fetch_active_units(): array
{
    $statement = db()->prepare(
        'select tb2_id as id, tb2_nome as name
         from tb2_unidades
         where tb2_status = 1
         order by tb2_nome asc'
    );
    $statement->execute();

    return array_map(static fn (array $row): array => [
        'id' => (int) ($row['id'] ?? 0),
        'name' => (string) ($row['name'] ?? ''),
    ], $statement->fetchAll());
}

function find_remanejamento_user(int $userId): ?array
{
    $conditions = user_activity_conditions('u');
    $conditions[] = 'u.id = :user_id';
    $whereSql = ' where ' . implode(' and ', $conditions);

    $statement = db()->prepare(
        "select
            u.id,
            u.name,
            u.tb2_id as unit_id,
            unit.tb2_nome as unit_name
         from users u
         left join tb2_unidades unit on unit.tb2_id = u.tb2_id
         {$whereSql}
         limit 1"
    );
    $statement->execute(['user_id' => $userId]);
    $row = $statement->fetch();

    if (!$row) {
        return null;
    }

    return [
        'id' => (int) ($row['id'] ?? 0),
        'name' => (string) ($row['name'] ?? ''),
        'unit_id' => $row['unit_id'] === null ? null : (int) $row['unit_id'],
        'unit_name' => (string) ($row['unit_name'] ?? ''),
    ];
}

try {
    if ($requestMethod === 'GET') {
        json_response([
            'ok' => true,
            'users' => fetch_remanejamento_users(),
            'units' => fetch_active_units(),
        ]);
    }

    if ($requestMethod !== 'POST') {
        json_response(['ok' => false, 'error' => 'Metodo nao permitido.'], 405);
    }

    $payload = input_json();
    $userId = (int) ($payload['user_id'] ?? 0);
    $unitId = (int) ($payload['unit_id'] ?? 0);

    if ($userId <= 0) {
        json_response(['ok' => false, 'error' => 'Funcionario invalido.'], 422);
    }

    if ($unitId <= 0) {
        json_response(['ok' => false, 'error' => 'Loja invalida.'], 422);
    }

    $user = find_remanejamento_user($userId);
    if (!$user) {
        json_response(['ok' => false, 'error' => 'Funcionario nao encontrado ou inativo.'], 404);
    }

    $unitStatement = db()->prepare(
        'select tb2_id, tb2_nome
         from tb2_unidades
         where tb2_id = :unit_id
           and tb2_status = 1
         limit 1'
    );
    $unitStatement->execute(['unit_id' => $unitId]);
    $unit = $unitStatement->fetch();

    if (!$unit) {
        json_response(['ok' => false, 'error' => 'Loja nao encontrada ou inativa.'], 404);
    }

    if (!table_exists('tb2_unidade_user')) {
        json_response(['ok' => false, 'error' => 'Tabela de lojas por usuario nao encontrada.'], 500);
    }

    $now = (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->format('Y-m-d H:i:s');
    $pdo = db();

    $pdo->beginTransaction();

    $userColumns = table_columns('users');
    $userUpdateParts = ['tb2_id = :unit_id'];
    $commonParams = [
        'user_id' => $userId,
        'unit_id' => $unitId,
    ];

    if (in_array('updated_at', $userColumns, true)) {
        $userUpdateParts[] = 'updated_at = :updated_at';
        $commonParams['updated_at'] = $now;
    }

    $updateUser = $pdo->prepare(
        'update users
         set ' . implode(', ', $userUpdateParts) . '
         where id = :user_id'
    );
    $updateUser->execute($commonParams);

    $deletePivot = $pdo->prepare('delete from tb2_unidade_user where user_id = :user_id');
    $deletePivot->execute(['user_id' => $userId]);

    $pivotColumns = table_columns('tb2_unidade_user');
    $pivotInsertColumns = ['user_id', 'tb2_id'];
    $pivotInsertValues = [':user_id', ':unit_id'];
    $pivotParams = [
        'user_id' => $userId,
        'unit_id' => $unitId,
    ];

    if (in_array('created_at', $pivotColumns, true)) {
        $pivotInsertColumns[] = 'created_at';
        $pivotInsertValues[] = ':created_at';
        $pivotParams['created_at'] = $now;
    }

    if (in_array('updated_at', $pivotColumns, true)) {
        $pivotInsertColumns[] = 'updated_at';
        $pivotInsertValues[] = ':pivot_updated_at';
        $pivotParams['pivot_updated_at'] = $now;
    }

    $insertPivot = $pdo->prepare(
        'insert into tb2_unidade_user (' . implode(', ', $pivotInsertColumns) . ')
         values (' . implode(', ', $pivotInsertValues) . ')'
    );
    $insertPivot->execute($pivotParams);

    if (table_exists('tb21_usuarios_online')) {
        $onlineColumns = table_columns('tb21_usuarios_online');
        $onlineUpdateParts = ['active_unit_id = :unit_id'];
        $onlineParams = [
            'user_id' => $userId,
            'unit_id' => $unitId,
        ];

        if (in_array('updated_at', $onlineColumns, true)) {
            $onlineUpdateParts[] = 'updated_at = :updated_at';
            $onlineParams['updated_at'] = $now;
        }

        $updateOnline = $pdo->prepare(
            'update tb21_usuarios_online
             set ' . implode(', ', $onlineUpdateParts) . '
             where user_id = :user_id'
        );
        $updateOnline->execute($onlineParams);
    }

    $pdo->commit();

    $updatedUser = find_remanejamento_user($userId);

    json_response([
        'ok' => true,
        'user' => $updatedUser,
        'message' => sprintf(
            'Funcionario %s remanejado para %s.',
            (string) ($updatedUser['name'] ?? 'selecionado'),
            (string) ($unit['tb2_nome'] ?? 'a loja selecionada')
        ),
    ]);
} catch (Throwable $exception) {
    $pdo = db();
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_response(['ok' => false, 'error' => 'Falha ao remanejar funcionario.'], 500);
}
