<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/_bootstrap.php';

const STOCK_COLUMN = 'tb1_qtd';

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

function stock_column_metadata(): ?array
{
    $statement = db()->prepare(
        'select column_type, is_nullable, column_default
         from information_schema.columns
         where table_schema = database()
           and table_name = "tb1_produto"
           and column_name = :column_name
         limit 1'
    );
    $statement->execute(['column_name' => STOCK_COLUMN]);
    $row = $statement->fetch();

    return $row ?: null;
}

function ensure_stock_column(): void
{
    $columns = table_columns('tb1_produto');

    if (!in_array(STOCK_COLUMN, $columns, true)) {
        db()->exec('alter table tb1_produto add column tb1_qtd int not null default 0 after tb1_tipo');
        return;
    }

    $metadata = stock_column_metadata();
    $columnType = strtolower((string) ($metadata['column_type'] ?? ''));

    if (str_contains($columnType, 'unsigned')) {
        db()->exec('alter table tb1_produto modify column tb1_qtd int not null default 0');
    }
}

function type_label(int $type): string
{
    return match ($type) {
        0 => 'Industria',
        1 => 'Balanca',
        2 => 'Servico',
        3 => 'Producao',
        default => 'Tipo ' . $type,
    };
}

function default_type_filters(): array
{
    return [0, 1, 3];
}

function requested_type_filters(): array
{
    $rawTypes = trim((string) ($_GET['types'] ?? ''));

    if ($rawTypes === '') {
        return default_type_filters();
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

function status_label(int $status): string
{
    return $status === 1 ? 'Ativo' : 'Inativo';
}

function normalize_product_row(array $row): array
{
    $type = (int) ($row['type'] ?? 0);
    $status = (int) ($row['status'] ?? 1);

    return [
        'id' => (int) ($row['id'] ?? 0),
        'name' => (string) ($row['name'] ?? ''),
        'barcode' => (string) ($row['barcode'] ?? ''),
        'type' => $type,
        'type_label' => type_label($type),
        'quantity' => (int) ($row['quantity'] ?? 0),
        'status' => $status,
        'status_label' => status_label($status),
    ];
}

function product_select_sql(): string
{
    $columns = table_columns('tb1_produto');
    $statusSelect = in_array('tb1_status', $columns, true) ? 'tb1_status' : '1';

    return "select
            tb1_id as id,
            tb1_nome as name,
            tb1_codbar as barcode,
            tb1_tipo as type,
            tb1_qtd as quantity,
            {$statusSelect} as status
        from tb1_produto";
}

function find_product(int $productId): ?array
{
    $statement = db()->prepare(product_select_sql() . ' where tb1_id = :product_id limit 1');
    $statement->execute(['product_id' => $productId]);
    $row = $statement->fetch();

    return $row ? normalize_product_row($row) : null;
}

try {
    ensure_stock_column();

    if ($requestMethod === 'GET') {
        $search = trim((string) ($_GET['q'] ?? ''));
        $params = [];
        $whereParts = [];

        $typeFilters = requested_type_filters();

        if ($typeFilters !== []) {
            $whereParts[] = 'tb1_tipo in (' . implode(', ', array_map('intval', $typeFilters)) . ')';
        }

        if ($search !== '') {
            $safeTerm = str_replace(['%', '_'], ['\\%', '\\_'], $search);
            $likeTerm = '%' . $safeTerm . '%';
            $params['search_like'] = $likeTerm;

            if (ctype_digit($search)) {
                $whereParts[] = '(tb1_id = :search_id or tb1_codbar like :search_like)';
                $params['search_id'] = (int) $search;
            } else {
                $whereParts[] = 'tb1_nome like :search_like';
            }
        }

        $whereSql = $whereParts === [] ? '' : ' where ' . implode(' and ', $whereParts);

        $columns = table_columns('tb1_produto');
        $orderSql = in_array('tb1_status', $columns, true)
            ? ' order by tb1_status desc, tb1_nome asc'
            : ' order by tb1_nome asc';

        $statement = db()->prepare(product_select_sql() . $whereSql . $orderSql . ' limit 80');
        $statement->execute($params);

        json_response([
            'ok' => true,
            'search' => $search,
            'items' => array_map('normalize_product_row', $statement->fetchAll()),
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

    $product = find_product($productId);
    if (!$product) {
        json_response(['ok' => false, 'error' => 'Produto nao encontrado.'], 404);
    }

    $update = db()->prepare('update tb1_produto set tb1_qtd = :quantity where tb1_id = :product_id');
    $update->execute([
        'quantity' => $quantity,
        'product_id' => $productId,
    ]);

    json_response([
        'ok' => true,
        'item' => find_product($productId),
        'message' => 'Estoque atualizado com sucesso.',
    ]);
} catch (Throwable $exception) {
    $message = $requestMethod === 'GET'
        ? 'Falha ao carregar estoque.'
        : 'Falha ao atualizar estoque.';

    json_response(['ok' => false, 'error' => $message], 500);
}
