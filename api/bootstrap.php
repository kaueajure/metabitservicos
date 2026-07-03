<?php
declare(strict_types=1);

function app_root(): string
{
    return dirname(__DIR__);
}

function load_env_file(): void
{
    $envPath = app_root() . DIRECTORY_SEPARATOR . '.env';
    if (!is_file($envPath)) {
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        $value = trim($value, "\"'");

        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
        }
    }
}

function app_env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    load_env_file();
    $connection = strtolower(app_env('DB_CONNECTION', 'mysql') ?? 'mysql');
    if ($connection !== 'mysql') {
        throw new RuntimeException('Invalid DB_CONNECTION. This project supports only MySQL.');
    }

    $host = app_env('DB_HOST', '127.0.0.1');
    $port = app_env('DB_PORT', '3306');
    $database = app_env('DB_DATABASE', 'database');
    $username = app_env('DB_USERNAME', 'root');
    $password = app_env('DB_PASSWORD', '');
    $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

    $pdo = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    return $pdo;
}

function json_response(mixed $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string|false
{
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'), true);
}

function jwt_secret(): string
{
    return app_env('JWT_SECRET', 'metabit_secret_key_123') ?? 'metabit_secret_key_123';
}

function jwt_sign(array $payload, int $ttlSeconds = 604800): string
{
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $payload['iat'] = time();
    $payload['exp'] = time() + $ttlSeconds;

    $segments = [
        base64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES)),
        base64url_encode(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)),
    ];

    $signature = hash_hmac('sha256', implode('.', $segments), jwt_secret(), true);
    $segments[] = base64url_encode($signature);
    return implode('.', $segments);
}

function jwt_verify_token(string $token): array
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        throw new RuntimeException('Invalid token');
    }

    [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, jwt_secret(), true));
    if (!hash_equals($expected, $encodedSignature)) {
        throw new RuntimeException('Invalid token signature');
    }

    $payload = json_decode((string) base64url_decode($encodedPayload), true);
    if (!is_array($payload) || (isset($payload['exp']) && (int) $payload['exp'] < time())) {
        throw new RuntimeException('Expired token');
    }

    return $payload;
}

function bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $header, $matches)) {
        return trim($matches[1]);
    }
    return null;
}

function require_auth(): array
{
    $token = bearer_token();
    if (!$token) {
        json_response(['error' => 'Unauthorized: Missing token'], 401);
    }

    try {
        return jwt_verify_token($token);
    } catch (Throwable) {
        json_response(['error' => 'Unauthorized: Invalid token'], 401);
    }
}

function fetch_user_access(PDO $pdo, int $userId): array
{
    $roleStmt = $pdo->prepare(
        'SELECT r.slug
         FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = ? AND r.deleted_at IS NULL'
    );
    $roleStmt->execute([$userId]);
    $roles = array_values(array_unique(array_map(fn ($row) => $row['slug'], $roleStmt->fetchAll())));

    $permissionStmt = $pdo->prepare(
        'SELECT p.slug
         FROM user_roles ur
         INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
         INNER JOIN permissions p ON p.id = rp.permission_id
         WHERE ur.user_id = ? AND p.deleted_at IS NULL'
    );
    $permissionStmt->execute([$userId]);
    $permissions = array_values(array_unique(array_map(fn ($row) => $row['slug'], $permissionStmt->fetchAll())));

    return ['roles' => $roles, 'permissions' => $permissions];
}

function map_user(array $row, PDO $pdo): array
{
    $access = fetch_user_access($pdo, (int) $row['id']);
    return [
        'id' => (int) $row['id'],
        'uid' => $row['uid'],
        'email' => $row['email'],
        'name' => $row['name'],
        'employeeName' => $row['employee_name'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
        'roles' => $access['roles'],
        'permissions' => $access['permissions'],
    ];
}

function current_user(PDO $pdo, array $auth): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM users WHERE uid = ? AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([$auth['uid'] ?? '']);
    $row = $stmt->fetch();
    return $row ? map_user($row, $pdo) : null;
}
