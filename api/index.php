<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$COMPETENCES = [
    'MSC' => ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro', 'Encerramento'],
    'RREO' => ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'],
    'RGF' => ['1º Quadrimestre', '2º Quadrimestre', '3º Quadrimestre'],
    'DCA' => ['Anual'],
    'SIOPE' => ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'],
    'SIOPS' => ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'],
];

function route_path(): string
{
    $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $apiPos = strpos($uri, '/api');
    if ($apiPos !== false) {
        $uri = substr($uri, $apiPos + 4);
    }
    $uri = '/' . trim($uri, '/');
    return $uri === '/' ? '/' : $uri;
}

function map_municipality(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'name' => $row['name'],
        'state' => $row['state'],
        'responsible' => $row['responsible'],
        'phone' => $row['phone'],
        'email' => $row['email'],
        'observations' => $row['observations'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function map_task(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'municipalityId' => (int) $row['municipality_id'],
        'obligationCode' => $row['obligation_code'],
        'competence' => $row['competence'],
        'year' => (int) $row['year'],
        'status' => $row['status'],
        'siopsMembros' => $row['siops_membros'],
        'siopeFolha' => $row['siope_folha'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function map_history(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'taskId' => (int) $row['task_id'],
        'fieldChanged' => $row['field_changed'],
        'oldValue' => $row['old_value'],
        'newValue' => $row['new_value'],
        'userWhoChanged' => $row['user_who_changed'],
        'observation' => $row['observation'],
        'createdAt' => $row['created_at'],
        'updatedAt' => $row['updated_at'],
    ];
}

function map_comment(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'taskId' => (int) $row['task_id'],
        'authorName' => $row['author_name'],
        'text' => $row['text'],
        'createdAt' => $row['created_at'],
    ];
}

function map_attachment(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'taskId' => (int) $row['task_id'],
        'commentId' => $row['comment_id'] === null ? null : (int) $row['comment_id'],
        'fileName' => $row['file_name'],
        'fileType' => $row['file_type'],
        'fileSize' => (int) $row['file_size'],
        'fileData' => $row['file_data'],
        'uploadedAt' => $row['uploaded_at'],
    ];
}

function normalize_admin_name(?string $name): ?string
{
    return $name && strtolower(trim($name)) === 'comercialmetabit@gmail.com' ? 'Administrador' : $name;
}

function assign_role(PDO $pdo, int $userId, string $roleSlug): void
{
    $stmt = $pdo->prepare(
        'INSERT IGNORE INTO user_roles (user_id, role_id)
         SELECT ?, id FROM roles WHERE slug = ? AND deleted_at IS NULL LIMIT 1'
    );
    $stmt->execute([$userId, $roleSlug]);
}

function parse_responsible(?string $responsible): array
{
    $defaultServices = [
        'MSC' => true,
        'RREO' => true,
        'RGF' => true,
        'DCA' => true,
        'SIOPE' => true,
        'SIOPS' => true,
    ];

    if ($responsible && str_starts_with($responsible, '{')) {
        $decoded = json_decode($responsible, true);
        if (is_array($decoded)) {
            $decoded['_activeServices'] = $decoded['_activeServices'] ?? $defaultServices;
            return $decoded;
        }
    }

    $value = $responsible === '-' ? '' : ($responsible ?? '');
    return [
        'MSC' => $value,
        'RREO' => $value,
        'RGF' => $value,
        'DCA' => $value,
        'SIOPE' => $value,
        'SIOPS' => $value,
        '_activeServices' => $defaultServices,
    ];
}

function get_due_date(string $obligationCode, string $competence, int $year): DateTime
{
    $endMonth = 12;
    if ($obligationCode === 'MSC') {
        $months = [
            'Janeiro' => 1,
            'Fevereiro' => 2,
            'Março' => 3,
            'Abril' => 4,
            'Maio' => 5,
            'Junho' => 6,
            'Julho' => 7,
            'Agosto' => 8,
            'Setembro' => 9,
            'Outubro' => 10,
            'Novembro' => 11,
            'Dezembro' => 12,
            'Encerramento' => 12,
        ];
        $endMonth = $months[$competence] ?? 12;
    } elseif (in_array($obligationCode, ['RREO', 'SIOPE', 'SIOPS'], true)) {
        $bimesters = [
            '1º Bimestre' => 2,
            '2º Bimestre' => 4,
            '3º Bimestre' => 6,
            '4º Bimestre' => 8,
            '5º Bimestre' => 10,
            '6º Bimestre' => 12,
        ];
        $endMonth = $bimesters[$competence] ?? 12;
    } elseif ($obligationCode === 'RGF') {
        $quadrimesters = [
            '1º Quadrimestre' => 4,
            '2º Quadrimestre' => 8,
            '3º Quadrimestre' => 12,
        ];
        $endMonth = $quadrimesters[$competence] ?? 12;
    }

    $dueMonth = $endMonth + 1;
    $dueYear = $year;
    if ($dueMonth > 12) {
        $dueMonth = 1;
        $dueYear++;
    }

    $date = new DateTime(sprintf('%04d-%02d-01 23:59:59', $dueYear, $dueMonth));
    $date->modify('last day of this month');
    return $date;
}

function is_task_overdue(string $status, string $obligationCode, string $competence, int $year): bool
{
    if ($status === 'Homologado' || $status === 'Enviado') {
        return false;
    }
    return (new DateTime()) > get_due_date($obligationCode, $competence, $year);
}

function fetch_task(PDO $pdo, int $taskId): ?array
{
    $stmt = $pdo->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
    $stmt->execute([$taskId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function insert_history(PDO $pdo, int $taskId, string $fieldChanged, ?string $oldValue, ?string $newValue, ?string $userWhoChanged, ?string $observation): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO history (task_id, field_changed, old_value, new_value, user_who_changed, observation)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$taskId, $fieldChanged, $oldValue, $newValue, $userWhoChanged, $observation]);
}

function ensure_task_status(PDO $pdo, int $municipalityId, string $obligationCode, string $competence, int $year, string $newStatus, ?string $userWhoChanged, ?string $observation, ?int $currentTaskId = null, array &$currentUpdate = []): void
{
    $stmt = $pdo->prepare(
        'SELECT * FROM tasks WHERE municipality_id = ? AND obligation_code = ? AND competence = ? AND year = ? LIMIT 1'
    );
    $stmt->execute([$municipalityId, $obligationCode, $competence, $year]);
    $task = $stmt->fetch();

    if ($task) {
        $taskId = (int) $task['id'];
        if ($currentTaskId !== null && $taskId === $currentTaskId) {
            if ($task['status'] !== $newStatus) {
                $currentUpdate['status'] = $newStatus;
                insert_history($pdo, $taskId, 'status', $task['status'], $newStatus, $userWhoChanged, $observation);
            }
            return;
        }

        if ($task['status'] === 'Falta XML') {
            $update = $pdo->prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            $update->execute([$newStatus, $taskId]);
            insert_history($pdo, $taskId, 'status', $task['status'], $newStatus, $userWhoChanged, $observation);
        }
        return;
    }

    $insert = $pdo->prepare(
        'INSERT INTO tasks (municipality_id, obligation_code, competence, year, status, siops_membros, siope_folha)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $insert->execute([
        $municipalityId,
        $obligationCode,
        $competence,
        $year,
        $newStatus,
        $obligationCode === 'SIOPS' ? 'Não Solicitado' : null,
        $obligationCode === 'SIOPE' ? 'Não Solicitado' : null,
    ]);
    insert_history($pdo, (int) $pdo->lastInsertId(), 'status', 'Falta XML', $newStatus, $userWhoChanged, $observation);
}

function get_or_create_tasks(PDO $pdo, int $year, string $obligationCode): array
{
    global $COMPETENCES;
    $competences = $COMPETENCES[$obligationCode] ?? [];
    if (!$competences) {
        return [];
    }

    $municipalities = $pdo->query('SELECT * FROM municipalities ORDER BY name')->fetchAll();
    if (!$municipalities) {
        return [];
    }

    $insert = $pdo->prepare(
        'INSERT IGNORE INTO tasks (municipality_id, obligation_code, competence, year, status, siops_membros, siope_folha)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    foreach ($municipalities as $municipality) {
        $responsible = parse_responsible($municipality['responsible']);
        if (($responsible['_activeServices'][$obligationCode] ?? true) === false) {
            continue;
        }

        foreach ($competences as $competence) {
            $insert->execute([
                (int) $municipality['id'],
                $obligationCode,
                $competence,
                $year,
                'Falta XML',
                $obligationCode === 'SIOPS' ? 'Não Solicitado' : null,
                $obligationCode === 'SIOPE' ? 'Não Solicitado' : null,
            ]);
        }
    }

    $stmt = $pdo->prepare(
        'SELECT * FROM tasks WHERE year = ? AND obligation_code = ? ORDER BY municipality_id, id'
    );
    $stmt->execute([$year, $obligationCode]);
    $tasks = array_map('map_task', $stmt->fetchAll());

    $municipalityMap = [];
    foreach ($municipalities as $municipality) {
        $municipalityMap[(int) $municipality['id']] = $municipality;
    }

    return array_values(array_filter($tasks, function (array $task) use ($municipalityMap, $obligationCode) {
        $municipality = $municipalityMap[$task['municipalityId']] ?? null;
        if (!$municipality) {
            return false;
        }
        $responsible = parse_responsible($municipality['responsible']);
        return ($responsible['_activeServices'][$obligationCode] ?? true) !== false;
    }));
}

function update_task_details(PDO $pdo, int $taskId, array $data): array
{
    global $COMPETENCES;
    $current = fetch_task($pdo, $taskId);
    if (!$current) {
        throw new RuntimeException('Tarefa nao encontrada.');
    }

    $pdo->beginTransaction();
    try {
        $currentUpdate = [];
        $userWhoChanged = $data['userWhoChanged'] ?? null;
        $observation = $data['observation'] ?? null;

        $status = $data['status'] ?? null;
        $isFromMissingToStarted = $current['status'] === 'Falta XML' && ($status === 'Não iniciado' || $status === 'Não Iniciado');
        if ($isFromMissingToStarted) {
            foreach ($COMPETENCES as $code => $competences) {
                if (in_array($current['competence'], $competences, true)) {
                    ensure_task_status($pdo, (int) $current['municipality_id'], $code, $current['competence'], (int) $current['year'], 'Não iniciado', $userWhoChanged, $observation, $taskId, $currentUpdate);
                }
            }

            $monthToBimester = [
                'Fevereiro' => '1º Bimestre',
                'Abril' => '2º Bimestre',
                'Junho' => '3º Bimestre',
                'Agosto' => '4º Bimestre',
                'Outubro' => '5º Bimestre',
                'Dezembro' => '6º Bimestre',
            ];
            if (isset($monthToBimester[$current['competence']])) {
                foreach (['RREO', 'SIOPE', 'SIOPS'] as $code) {
                    ensure_task_status($pdo, (int) $current['municipality_id'], $code, $monthToBimester[$current['competence']], (int) $current['year'], 'Não iniciado', $userWhoChanged, $observation);
                }
            }

            $monthToQuadrimester = [
                'Abril' => '1º Quadrimestre',
                'Agosto' => '2º Quadrimestre',
                'Dezembro' => '3º Quadrimestre',
            ];
            if (isset($monthToQuadrimester[$current['competence']])) {
                ensure_task_status($pdo, (int) $current['municipality_id'], 'RGF', $monthToQuadrimester[$current['competence']], (int) $current['year'], 'Não iniciado', $userWhoChanged, $observation);
            }

            if ($current['competence'] === 'Encerramento') {
                ensure_task_status($pdo, (int) $current['municipality_id'], 'DCA', 'Anual', (int) $current['year'], 'Não iniciado', $userWhoChanged, $observation);
            }
        } elseif ($status !== null && $status !== $current['status']) {
            $currentUpdate['status'] = $status;
            insert_history($pdo, $taskId, 'status', $current['status'], $status, $userWhoChanged, $observation);
        }

        if (array_key_exists('siopsMembros', $data) && $data['siopsMembros'] !== $current['siops_membros']) {
            $currentUpdate['siops_membros'] = $data['siopsMembros'];
            insert_history($pdo, $taskId, 'siopsMembros', $current['siops_membros'], $data['siopsMembros'], $userWhoChanged, $observation);
        }

        if (array_key_exists('siopeFolha', $data) && $data['siopeFolha'] !== $current['siope_folha']) {
            $currentUpdate['siope_folha'] = $data['siopeFolha'];
            insert_history($pdo, $taskId, 'siopeFolha', $current['siope_folha'], $data['siopeFolha'], $userWhoChanged, $observation);
        }

        if ($currentUpdate) {
            $fields = [];
            $values = [];
            foreach ($currentUpdate as $field => $value) {
                $fields[] = "{$field} = ?";
                $values[] = $value;
            }
            $fields[] = 'updated_at = CURRENT_TIMESTAMP';
            $values[] = $taskId;
            $stmt = $pdo->prepare('UPDATE tasks SET ' . implode(', ', $fields) . ' WHERE id = ?');
            $stmt->execute($values);
        }

        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    return map_task(fetch_task($pdo, $taskId));
}

function increment_stat_bucket(array &$map, string $key, bool $isCompleted): void
{
    if (!isset($map[$key])) {
        $map[$key] = ['Concluído' => 0, 'Pendente' => 0];
    }
    $map[$key][$isCompleted ? 'Concluído' : 'Pendente']++;
}

function handle_stats(PDO $pdo): void
{
    $municipalities = $pdo->query('SELECT * FROM municipalities')->fetchAll();
    $tasks = $pdo->query('SELECT * FROM tasks')->fetchAll();
    $history = $pdo->query('SELECT * FROM history ORDER BY id ASC')->fetchAll();

    $municipalityMap = [];
    foreach ($municipalities as $municipality) {
        $municipalityMap[(int) $municipality['id']] = $municipality;
    }

    $completedBy = [];
    foreach ($history as $item) {
        if ($item['field_changed'] === 'status' && in_array($item['new_value'], ['Homologado', 'Enviado'], true) && $item['user_who_changed']) {
            $completedBy[(int) $item['task_id']] = normalize_admin_name(trim($item['user_who_changed']));
        }
    }

    $activeTasks = array_values(array_filter($tasks, function (array $task) use ($municipalityMap) {
        $municipality = $municipalityMap[(int) $task['municipality_id']] ?? null;
        if (!$municipality) {
            return false;
        }
        $responsible = parse_responsible($municipality['responsible']);
        return ($responsible['_activeServices'][$task['obligation_code']] ?? true) !== false;
    }));

    $statusCounts = [
        'Falta XML' => 0,
        'Não iniciado' => 0,
        'Pendência Cliente' => 0,
        'Trabalhando' => 0,
        'Retificar' => 0,
        'Enviado' => 0,
        'Homologado' => 0,
    ];
    $obligationStats = [];
    $municipalityStats = [];
    $competenceStats = [];
    $responsibleStats = [];
    $overdueStats = [
        'totalOverdue' => 0,
        'overdueByObligation' => [],
        'overdueByMunicipality' => [],
        'overdueByResponsible' => [],
    ];

    foreach ($activeTasks as $task) {
        $statusCounts[$task['status']] = ($statusCounts[$task['status']] ?? 0) + 1;
        $municipality = $municipalityMap[(int) $task['municipality_id']] ?? null;
        $municipalityName = $municipality['name'] ?? 'Outro';
        $code = $task['obligation_code'];
        $competence = $task['competence'];
        $isCompleted = in_array($task['status'], ['Homologado', 'Enviado'], true);

        increment_stat_bucket($obligationStats, $code, $isCompleted);
        increment_stat_bucket($municipalityStats, $municipalityName, $isCompleted);
        increment_stat_bucket($competenceStats, $competence, $isCompleted);

        $responsibles = [];
        if ($isCompleted && isset($completedBy[(int) $task['id']])) {
            $responsibles = [$completedBy[(int) $task['id']]];
        } elseif ($municipality) {
            $responsiblePayload = parse_responsible($municipality['responsible']);
            $assigned = $responsiblePayload[$code] ?? '';
            $responsibles = array_values(array_filter(array_map('trim', explode(',', (string) $assigned))));
        }
        if (!$responsibles) {
            $responsibles = ['Não Atribuído'];
        }

        foreach ($responsibles as $responsible) {
            if (!isset($responsibleStats[$responsible])) {
                $responsibleStats[$responsible] = [
                    'name' => $responsible,
                    'Concluido' => 0,
                    'Pendente' => 0,
                    'municipalities' => [],
                ];
            }
            $responsibleStats[$responsible]['municipalities'][$municipalityName] = true;
            $responsibleStats[$responsible][$isCompleted ? 'Concluido' : 'Pendente']++;
        }

        if (is_task_overdue($task['status'], $code, $competence, (int) $task['year'])) {
            $overdueStats['totalOverdue']++;
            $overdueStats['overdueByObligation'][$code] = ($overdueStats['overdueByObligation'][$code] ?? 0) + 1;
            $overdueStats['overdueByMunicipality'][$municipalityName] = ($overdueStats['overdueByMunicipality'][$municipalityName] ?? 0) + 1;
            foreach ($responsibles as $responsible) {
                $overdueStats['overdueByResponsible'][$responsible] = ($overdueStats['overdueByResponsible'][$responsible] ?? 0) + 1;
            }
        }
    }

    $totalTasks = count($activeTasks);
    $completedCount = ($statusCounts['Homologado'] ?? 0) + ($statusCounts['Enviado'] ?? 0);
    $responsibleRows = array_values(array_map(function (array $row) {
        $total = $row['Concluido'] + $row['Pendente'];
        return [
            'name' => $row['name'],
            'Concluido' => $row['Concluido'],
            'Pendente' => $row['Pendente'],
            'Total' => $total,
            'TaxaConclusao' => $total > 0 ? (int) round(($row['Concluido'] / $total) * 100) : 0,
            'MunicipiosAtendidos' => array_keys($row['municipalities']),
            'QtdMunicipios' => count($row['municipalities']),
        ];
    }, $responsibleStats));

    json_response([
        'totalMuns' => count($municipalities),
        'totalTasks' => $totalTasks,
        'statusCounts' => $statusCounts,
        'pctCompleted' => $totalTasks > 0 ? (int) round(($completedCount / $totalTasks) * 100) : 0,
        'pctPending' => $totalTasks > 0 ? 100 - (int) round(($completedCount / $totalTasks) * 100) : 0,
        'obligationStats' => $obligationStats,
        'municipalityStats' => $municipalityStats,
        'competenceStats' => $competenceStats,
        'responsibleStats' => $responsibleRows,
        'overdueStats' => $overdueStats,
    ]);
}

try {
    $pdo = pdo();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $path = route_path();

    if ($method === 'POST' && $path === '/auth/register') {
        $body = request_json();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        if ($email === '' || $password === '') {
            json_response(['error' => 'E-mail e senha são obrigatórios.'], 400);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            json_response(['error' => 'E-mail já cadastrado.'], 400);
        }

        $isAdminEmail = $email === 'comercialmetabit@gmail.com';
        $employeeName = $isAdminEmail ? 'Administrador' : (($body['employeeName'] ?? null) ?: null);
        $insert = $pdo->prepare(
            'INSERT INTO users (uid, email, password, name, employee_name) VALUES (?, ?, ?, ?, ?)'
        );
        $uid = bin2hex(random_bytes(16));
        $insert->execute([
            $uid,
            $email,
            password_hash($password, PASSWORD_BCRYPT),
            ($body['name'] ?? null) ?: null,
            $employeeName,
        ]);
        assign_role($pdo, (int) $pdo->lastInsertId(), $isAdminEmail ? 'admin' : 'operator');

        $user = current_user($pdo, ['uid' => $uid]);
        $token = jwt_sign(['uid' => $user['uid'], 'email' => $user['email'], 'name' => $user['name']]);
        json_response(['token' => $token, 'user' => $user], 201);
    }

    if ($method === 'POST' && $path === '/auth/login') {
        $body = request_json();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        if ($email === '' || $password === '') {
            json_response(['error' => 'E-mail e senha são obrigatórios.'], 400);
        }

        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        if (!$row || !password_verify($password, $row['password'])) {
            json_response(['error' => 'E-mail ou senha inválidos.'], 401);
        }

        $user = map_user($row, $pdo);
        $token = jwt_sign(['uid' => $user['uid'], 'email' => $user['email'], 'name' => $user['name']]);
        json_response(['token' => $token, 'user' => $user]);
    }

    $auth = require_auth();

    if ($method === 'GET' && $path === '/auth/me') {
        $user = current_user($pdo, $auth);
        if (!$user) {
            json_response(['error' => 'Usuário não encontrado'], 404);
        }
        json_response($user);
    }

    if ($method === 'POST' && $path === '/auth/logout') {
        json_response(['ok' => true]);
    }

    if ($method === 'POST' && $path === '/auth/link-employee') {
        $body = request_json();
        $employeeName = ($body['employeeName'] ?? null) ?: null;
        if (($auth['email'] ?? '') === 'comercialmetabit@gmail.com' && $employeeName !== 'Administrador') {
            json_response(['error' => 'O email comercialmetabit@gmail.com deve obrigatoriamente estar vinculado ao Administrador.'], 400);
        }
        $stmt = $pdo->prepare('UPDATE users SET employee_name = ? WHERE uid = ?');
        $stmt->execute([$employeeName, $auth['uid']]);
        json_response(current_user($pdo, $auth));
    }

    if ($method === 'GET' && $path === '/municipalities') {
        $rows = $pdo->query('SELECT * FROM municipalities ORDER BY name')->fetchAll();
        json_response(array_map('map_municipality', $rows));
    }

    if ($method === 'POST' && $path === '/municipalities') {
        $body = request_json();
        if (empty($body['name']) || empty($body['state'])) {
            json_response(['error' => 'O nome do município e o estado são obrigatórios.'], 400);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO municipalities (name, state, responsible, phone, email, observations) VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $body['name'],
            $body['state'],
            $body['responsible'] ?? '-',
            $body['phone'] ?? '-',
            $body['email'] ?? 'contato@municipio.gov.br',
            $body['observations'] ?? '',
        ]);
        $row = $pdo->query('SELECT * FROM municipalities WHERE id = ' . (int) $pdo->lastInsertId())->fetch();
        json_response(map_municipality($row), 201);
    }

    if (preg_match('#^/municipalities/(\d+)$#', $path, $matches)) {
        $id = (int) $matches[1];
        if ($method === 'PUT') {
            $body = request_json();
            if (empty($body['name']) || empty($body['state'])) {
                json_response(['error' => 'O nome do município e o estado são obrigatórios.'], 400);
            }
            $stmt = $pdo->prepare(
                'UPDATE municipalities SET name = ?, state = ?, responsible = ?, phone = ?, email = ?, observations = ? WHERE id = ?'
            );
            $stmt->execute([
                $body['name'],
                $body['state'],
                $body['responsible'] ?? '-',
                $body['phone'] ?? '-',
                $body['email'] ?? 'contato@municipio.gov.br',
                $body['observations'] ?? '',
                $id,
            ]);
            $stmt = $pdo->prepare('SELECT * FROM municipalities WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            json_response(map_municipality($stmt->fetch()));
        }

        if ($method === 'DELETE') {
            $stmt = $pdo->prepare('SELECT * FROM municipalities WHERE id = ? LIMIT 1');
            $stmt->execute([$id]);
            $existing = $stmt->fetch();
            $delete = $pdo->prepare('DELETE FROM municipalities WHERE id = ?');
            $delete->execute([$id]);
            json_response($existing ? map_municipality($existing) : null);
        }
    }

    if ($method === 'GET' && $path === '/tasks') {
        $year = (int) ($_GET['year'] ?? 0);
        $obligationCode = (string) ($_GET['obligationCode'] ?? '');
        if (!$year || $obligationCode === '') {
            json_response(['error' => 'Parametros "year" e "obligationCode" são obrigatórios.'], 400);
        }
        json_response(get_or_create_tasks($pdo, $year, $obligationCode));
    }

    if (preg_match('#^/tasks/(\d+)$#', $path, $matches) && $method === 'PUT') {
        $body = request_json();
        $userWhoChanged = trim((string) ($body['userWhoChanged'] ?? ($auth['email'] ?? 'Usuário')));
        $body['userWhoChanged'] = normalize_admin_name($userWhoChanged);
        $body['observation'] = isset($body['observation']) ? trim((string) $body['observation']) : null;
        json_response(update_task_details($pdo, (int) $matches[1], $body));
    }

    if (preg_match('#^/tasks/(\d+)/history$#', $path, $matches) && $method === 'GET') {
        $stmt = $pdo->prepare('SELECT * FROM history WHERE task_id = ? ORDER BY created_at');
        $stmt->execute([(int) $matches[1]]);
        $rows = array_map('map_history', $stmt->fetchAll());
        foreach ($rows as &$row) {
            $row['userWhoChanged'] = normalize_admin_name($row['userWhoChanged']);
        }
        unset($row);
        json_response($rows);
    }

    if (preg_match('#^/history/(\d+)$#', $path, $matches) && $method === 'PUT') {
        $id = (int) $matches[1];
        $body = request_json();
        $stmt = $pdo->prepare('SELECT * FROM history WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $existing = $stmt->fetch();
        if (!$existing) {
            json_response(['error' => 'Histórico não encontrado.'], 404);
        }

        $update = $pdo->prepare(
            'UPDATE history SET old_value = ?, new_value = ?, user_who_changed = ?, observation = ? WHERE id = ?'
        );
        $update->execute([
            $body['oldValue'] ?? null,
            $body['newValue'] ?? null,
            normalize_admin_name($body['userWhoChanged'] ?? null),
            $body['observation'] ?? null,
            $id,
        ]);

        if (!empty($body['newValue'])) {
            $fieldMap = ['status' => 'status', 'siopsMembros' => 'siops_membros', 'siopeFolha' => 'siope_folha'];
            $column = $fieldMap[$existing['field_changed']] ?? null;
            if ($column) {
                $taskUpdate = $pdo->prepare("UPDATE tasks SET {$column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
                $taskUpdate->execute([$body['newValue'], (int) $existing['task_id']]);
            }
        }

        $stmt = $pdo->prepare('SELECT * FROM history WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        json_response(map_history($stmt->fetch()));
    }

    if (preg_match('#^/tasks/(\d+)/comments$#', $path, $matches)) {
        $taskId = (int) $matches[1];
        if ($method === 'GET') {
            $stmt = $pdo->prepare('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at');
            $stmt->execute([$taskId]);
            $rows = array_map('map_comment', $stmt->fetchAll());
            foreach ($rows as &$row) {
                $row['authorName'] = normalize_admin_name($row['authorName']);
            }
            unset($row);
            json_response($rows);
        }

        if ($method === 'POST') {
            $body = request_json();
            $text = trim((string) ($body['text'] ?? ''));
            if ($text === '') {
                json_response(['error' => 'Texto do comentário é obrigatório.'], 400);
            }
            $author = normalize_admin_name(trim((string) ($body['authorName'] ?? ($auth['email'] ?? 'Usuário'))));
            $stmt = $pdo->prepare('INSERT INTO comments (task_id, author_name, text) VALUES (?, ?, ?)');
            $stmt->execute([$taskId, $author, $text]);
            $row = $pdo->query('SELECT * FROM comments WHERE id = ' . (int) $pdo->lastInsertId())->fetch();
            json_response(map_comment($row), 201);
        }
    }

    if (preg_match('#^/tasks/(\d+)/attachments$#', $path, $matches)) {
        $taskId = (int) $matches[1];
        if ($method === 'GET') {
            $stmt = $pdo->prepare('SELECT * FROM attachments WHERE task_id = ? ORDER BY uploaded_at');
            $stmt->execute([$taskId]);
            json_response(array_map('map_attachment', $stmt->fetchAll()));
        }

        if ($method === 'POST') {
            $body = request_json();
            foreach (['fileName', 'fileType', 'fileSize', 'fileData'] as $field) {
                if (!isset($body[$field]) || $body[$field] === '') {
                    json_response(['error' => 'Nome, tipo, tamanho e dados do arquivo (Base64) são obrigatórios.'], 400);
                }
            }
            $stmt = $pdo->prepare(
                'INSERT INTO attachments (task_id, file_name, file_type, file_size, file_data) VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([$taskId, $body['fileName'], $body['fileType'], (int) $body['fileSize'], $body['fileData']]);
            $row = $pdo->query('SELECT * FROM attachments WHERE id = ' . (int) $pdo->lastInsertId())->fetch();
            json_response(map_attachment($row), 201);
        }
    }

    if (preg_match('#^/attachments/(\d+)$#', $path, $matches) && $method === 'GET') {
        $stmt = $pdo->prepare('SELECT * FROM attachments WHERE id = ? LIMIT 1');
        $stmt->execute([(int) $matches[1]]);
        $row = $stmt->fetch();
        if (!$row) {
            json_response(['error' => 'Anexo não encontrado.'], 404);
        }
        $attachment = map_attachment($row);
        if (($_GET['json'] ?? '') === 'true') {
            json_response($attachment);
        }
        header('Content-Type: ' . $attachment['fileType']);
        header('Content-Disposition: attachment; filename="' . rawurlencode($attachment['fileName']) . '"');
        echo base64_decode($attachment['fileData']);
        exit;
    }

    if ($method === 'GET' && $path === '/stats') {
        handle_stats($pdo);
    }

    json_response(['error' => 'Rota não encontrada.'], 404);
} catch (Throwable $error) {
    json_response(['error' => $error->getMessage()], 500);
}
