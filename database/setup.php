<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/api/bootstrap.php';

function split_sql_statements(string $sql): array
{
    return array_values(array_filter(array_map('trim', explode(';', $sql))));
}

function run_migrations(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $executed = [];
    foreach ($pdo->query('SELECT name FROM schema_migrations')->fetchAll() as $row) {
        $executed[$row['name']] = true;
    }

    $files = glob(__DIR__ . '/migrations/*.sql') ?: [];
    sort($files, SORT_STRING);
    foreach ($files as $file) {
        $name = basename($file);
        if (isset($executed[$name])) {
            echo "Skipping {$name}\n";
            continue;
        }

        echo "Applying {$name}\n";
        foreach (split_sql_statements((string) file_get_contents($file)) as $statement) {
            $pdo->exec($statement);
        }
        $stmt = $pdo->prepare('INSERT INTO schema_migrations (name) VALUES (?)');
        $stmt->execute([$name]);
    }
}

function seed_data(PDO $pdo): void
{
    $data = json_decode((string) file_get_contents(__DIR__ . '/seeders/core-data.json'), true);
    if (!is_array($data)) {
        throw new RuntimeException('Invalid seeder data.');
    }

    foreach ($data['roles'] as $role) {
        $stmt = $pdo->prepare(
            'INSERT INTO roles (name, slug, description)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), deleted_at = NULL'
        );
        $stmt->execute([$role['name'], $role['slug'], $role['description']]);
    }

    foreach ($data['permissions'] as $permission) {
        $stmt = $pdo->prepare(
            'INSERT INTO permissions (name, slug, description)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description), deleted_at = NULL'
        );
        $stmt->execute([$permission['name'], $permission['slug'], $permission['description']]);
    }

    $permissionSlugs = array_map(fn ($permission) => $permission['slug'], $data['permissions']);
    foreach ($data['roles'] as $role) {
        $rolePermissions = $role['permissions'] === '*' ? $permissionSlugs : $role['permissions'];
        foreach ($rolePermissions as $permissionSlug) {
            $stmt = $pdo->prepare(
                'INSERT IGNORE INTO role_permissions (role_id, permission_id)
                 SELECT r.id, p.id FROM roles r INNER JOIN permissions p ON p.slug = ? WHERE r.slug = ?'
            );
            $stmt->execute([$permissionSlug, $role['slug']]);
        }
    }

    $admin = $data['admin'];
    $adminEmail = strtolower(trim(app_env('ADMIN_EMAIL', $admin['email']) ?? $admin['email']));
    $adminPassword = app_env('ADMIN_PASSWORD', $admin['password']) ?? $admin['password'];

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$adminEmail]);
    $existing = $stmt->fetch();
    if ($existing) {
        $adminId = (int) $existing['id'];
        $stmt = $pdo->prepare('UPDATE users SET name = ?, employee_name = ?, deleted_at = NULL WHERE id = ?');
        $stmt->execute([$admin['name'], $admin['employeeName'], $adminId]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO users (uid, email, password, name, employee_name) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([bin2hex(random_bytes(16)), $adminEmail, password_hash($adminPassword, PASSWORD_BCRYPT), $admin['name'], $admin['employeeName']]);
        $adminId = (int) $pdo->lastInsertId();
    }

    $stmt = $pdo->prepare('INSERT IGNORE INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE slug = ? LIMIT 1');
    $stmt->execute([$adminId, $admin['role']]);

    $hasMunicipality = $pdo->query('SELECT id FROM municipalities LIMIT 1')->fetch();
    if (!$hasMunicipality) {
        foreach ($data['municipalities'] as $municipality) {
            $responsible = json_encode([
                'MSC' => $municipality['responsible'],
                'RREO' => $municipality['responsible'],
                'RGF' => $municipality['responsible'],
                'DCA' => $municipality['responsible'],
                'SIOPE' => $municipality['responsible'],
                'SIOPS' => $municipality['responsible'],
                '_activeServices' => [
                    'MSC' => true,
                    'RREO' => true,
                    'RGF' => true,
                    'DCA' => true,
                    'SIOPE' => true,
                    'SIOPS' => true,
                ],
            ], JSON_UNESCAPED_UNICODE);

            $stmt = $pdo->prepare(
                'INSERT INTO municipalities (name, state, responsible, phone, email, observations)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $municipality['name'],
                $municipality['state'],
                $responsible,
                $municipality['phone'],
                $municipality['email'],
                $municipality['observations'],
            ]);
        }
    }
}

$pdo = pdo();
run_migrations($pdo);
seed_data($pdo);
echo "Database setup completed.\n";
