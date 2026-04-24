<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Authorization, Content-Type, Accept');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($requestMethod === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function load_env_file(string $path): void
{
    if (!is_file($path) || !is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);

        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $separator = strpos($line, '=');
        if ($separator === false) {
            continue;
        }

        $name = trim(substr($line, 0, $separator));
        $value = trim(substr($line, $separator + 1));

        if ($name === '' || getenv($name) !== false) {
            continue;
        }

        if (
            strlen($value) >= 2 &&
            (($value[0] === '"' && $value[strlen($value) - 1] === '"') ||
                ($value[0] === "'" && $value[strlen($value) - 1] === "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        putenv("{$name}={$value}");
        $_ENV[$name] = $value;
        $_SERVER[$name] = $value;
    }
}

load_env_file(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');
load_env_file(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env.local');

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $host = getenv('DB_HOST') ?: '';
    $database = getenv('DB_DATABASE') ?: '';
    $username = getenv('DB_USERNAME') ?: '';
    $password = getenv('DB_PASSWORD') ?: '';
    $sslCa = getenv('MYSQL_ATTR_SSL_CA') ?: null;

    if ($host === '' || $database === '' || $username === '' || $password === '') {
        json_response(['ok' => false, 'error' => 'Configuracao do banco incompleta.'], 500);
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    if ($sslCa) {
        $options[PDO::MYSQL_ATTR_SSL_CA] = $sslCa;
    }

    $pdo = new PDO(
        "mysql:host={$host};port=3306;dbname={$database};charset=utf8mb4",
        $username,
        $password,
        $options
    );

    return $pdo;
}

function input_json(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);

    if (is_array($data)) {
        return $data;
    }

    if (!empty($_POST) && is_array($_POST)) {
        return $_POST;
    }

    $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
    if (str_contains($contentType, 'application/x-www-form-urlencoded')) {
        parse_str($raw, $formData);
        return is_array($formData) ? $formData : [];
    }

    return [];
}

function unsupported_orders_endpoint(): void
{
    json_response([
        'ok' => false,
        'error' => 'Endpoint de pedidos ainda nao configurado nesta base. As tabelas de pedidos nao foram encontradas no banco informado.',
    ], 501);
}
