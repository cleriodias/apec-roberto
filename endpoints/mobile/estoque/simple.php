<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/_bootstrap.php';

function estoque_column_exists(string $columnName): bool
{
    $safeColumn = str_replace("'", "''", $columnName);
    $statement = db()->query("show columns from tb1_produto like '{$safeColumn}'");

    return (bool) $statement->fetch();
}

function estoque_column_type(string $columnName): string
{
    $safeColumn = str_replace("'", "''", $columnName);
    $statement = db()->query("show columns from tb1_produto like '{$safeColumn}'");
    $row = $statement->fetch();

    return strtolower((string) ($row['Type'] ?? $row['type'] ?? ''));
}

function estoque_ensure_quantity_column(): void
{
    if (!estoque_column_exists('tb1_qtd')) {
        db()->exec('alter table tb1_produto add column tb1_qtd int not null default 0 after tb1_tipo');
        return;
    }

    if (str_contains(estoque_column_type('tb1_qtd'), 'unsigned')) {
        db()->exec('alter table tb1_produto modify column tb1_qtd int not null default 0');
    }
}

function estoque_type_label(int $type): string
{
    return match ($type) {
        0 => 'Industria',
        1 => 'Balanca',
        2 => 'Servico',
        3 => 'Producao',
        default => 'Tipo ' . $type,
    };
}

function estoque_default_type_filters(): array
{
    return [0, 1, 3];
}

function estoque_requested_type_filters(): array
{
    $rawTypes = trim((string) ($_GET['types'] ?? ''));

    if ($rawTypes === '') {
        return estoque_default_type_filters();
    }

    $types = [];

    foreach (explode(',', $rawTypes) as $type) {
        $normalized = trim($type);

        if ($normalized === '' || !preg_match('/^-?\d+$/', $normalized)) {
            continue;
        }

        $types[] = (int) $normalized;
    }

    return array_values(array_unique($types));
}

function estoque_product_payload(array $row): array
{
    $type = (int) ($row['type'] ?? 0);
    $status = (int) ($row['status'] ?? 1);

    return [
        'id' => (int) ($row['id'] ?? 0),
        'name' => (string) ($row['name'] ?? ''),
        'barcode' => (string) ($row['barcode'] ?? ''),
        'type' => $type,
        'type_label' => estoque_type_label($type),
        'quantity' => (int) ($row['quantity'] ?? 0),
        'status' => $status,
        'status_label' => $status === 1 ? 'Ativo' : 'Inativo',
    ];
}

function estoque_select_sql(): string
{
    $statusSelect = estoque_column_exists('tb1_status') ? 'tb1_status' : '1';

    return "select
            tb1_id as id,
            tb1_nome as name,
            tb1_codbar as barcode,
            tb1_tipo as type,
            tb1_qtd as quantity,
            {$statusSelect} as status
        from tb1_produto";
}

try {
    estoque_ensure_quantity_column();

    if ($requestMethod === 'GET') {
        $search = trim((string) ($_GET['q'] ?? ''));
        $params = [];
        $whereParts = [];

        $typeFilters = estoque_requested_type_filters();

        if ($typeFilters !== []) {
            $whereParts[] = 'tb1_tipo in (' . implode(', ', array_map('intval', $typeFilters)) . ')';
        }

        if ($search !== '') {
            $safeTerm = str_replace(['%', '_'], ['\\%', '\\_'], $search);
            $params['search_like'] = '%' . $safeTerm . '%';

            if (ctype_digit($search)) {
                $whereParts[] = '(tb1_id = :search_id or tb1_codbar like :search_like)';
                $params['search_id'] = (int) $search;
            } else {
                $whereParts[] = 'tb1_nome like :search_like';
            }
        }

        $whereSql = $whereParts === [] ? '' : ' where ' . implode(' and ', $whereParts);

        $orderSql = estoque_column_exists('tb1_status')
            ? ' order by tb1_status desc, tb1_nome asc'
            : ' order by tb1_nome asc';

        $statement = db()->prepare(estoque_select_sql() . $whereSql . $orderSql . ' limit 80');
        $statement->execute($params);

        json_response([
            'ok' => true,
            'search' => $search,
            'items' => array_map('estoque_product_payload', $statement->fetchAll()),
        ]);
    }

    if ($requestMethod !== 'POST') {
        json_response(['ok' => false, 'error' => 'Metodo nao permitido.'], 405);
    }

    $payload = input_json();
    $productId = (int) ($payload['product_id'] ?? 0);
    $quantityRaw = $payload['quantity'] ?? null;

    if ($productId <= 0) {
        json_response(['ok' => false, 'error' => 'Produto invalido.'], 422);
    }

    if (!is_numeric($quantityRaw)) {
        json_response(['ok' => false, 'error' => 'Quantidade invalida.'], 422);
    }

    $quantity = (int) $quantityRaw;

    $update = db()->prepare('update tb1_produto set tb1_qtd = :quantity where tb1_id = :product_id');
    $update->execute([
        'quantity' => $quantity,
        'product_id' => $productId,
    ]);

    if ($update->rowCount() < 1) {
        json_response(['ok' => false, 'error' => 'Produto nao encontrado.'], 404);
    }

    $statement = db()->prepare(estoque_select_sql() . ' where tb1_id = :product_id limit 1');
    $statement->execute(['product_id' => $productId]);

    json_response([
        'ok' => true,
        'item' => estoque_product_payload($statement->fetch() ?: []),
        'message' => 'Estoque atualizado com sucesso.',
    ]);
} catch (Throwable $exception) {
    $message = $requestMethod === 'GET'
        ? 'Falha ao carregar estoque.'
        : 'Falha ao atualizar estoque.';

    json_response(['ok' => false, 'error' => $message], 500);
}
