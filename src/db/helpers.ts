import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import { createPool } from './index.ts';
import { COMPETENCES } from '../types.ts';

const pool = createPool();

type Row = RowDataPacket & Record<string, any>;

function mapMunicipality(row: Row) {
  return {
    id: Number(row.id),
    name: row.name,
    state: row.state,
    responsible: row.responsible,
    phone: row.phone,
    email: row.email,
    observations: row.observations,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTask(row: Row) {
  return {
    id: Number(row.id),
    municipalityId: Number(row.municipality_id),
    obligationCode: row.obligation_code,
    competence: row.competence,
    year: Number(row.year),
    status: row.status,
    siopsMembros: row.siops_membros,
    siopeFolha: row.siope_folha,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapHistory(row: Row) {
  return {
    id: Number(row.id),
    taskId: Number(row.task_id),
    fieldChanged: row.field_changed,
    oldValue: row.old_value,
    newValue: row.new_value,
    userWhoChanged: row.user_who_changed,
    observation: row.observation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapComment(row: Row) {
  return {
    id: Number(row.id),
    taskId: Number(row.task_id),
    authorName: row.author_name,
    text: row.text,
    createdAt: row.created_at,
  };
}

function mapAttachment(row: Row) {
  return {
    id: Number(row.id),
    taskId: Number(row.task_id),
    commentId: row.comment_id === null ? null : Number(row.comment_id),
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: Number(row.file_size),
    fileData: row.file_data,
    uploadedAt: row.uploaded_at,
  };
}

async function getAccessForUser(userId: number) {
  const [roleRows] = await pool.query<Row[]>(
    `SELECT r.slug
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = ? AND r.deleted_at IS NULL`,
    [userId]
  );
  const [permissionRows] = await pool.query<Row[]>(
    `SELECT p.slug
     FROM user_roles ur
     INNER JOIN role_permissions rp ON rp.role_id = ur.role_id
     INNER JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = ? AND p.deleted_at IS NULL`,
    [userId]
  );

  return {
    roles: [...new Set(roleRows.map((row) => row.slug))],
    permissions: [...new Set(permissionRows.map((row) => row.slug))],
  };
}

async function mapUser(row: Row | null) {
  if (!row) return null;
  const access = await getAccessForUser(Number(row.id));
  return {
    id: Number(row.id),
    uid: row.uid,
    email: row.email,
    name: row.name,
    employeeName: row.employee_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roles: access.roles,
    permissions: access.permissions,
  };
}

async function assignRoleToUser(userId: number, roleSlug: string) {
  await pool.query(
    `INSERT IGNORE INTO user_roles (user_id, role_id)
     SELECT ?, id FROM roles WHERE slug = ? AND deleted_at IS NULL LIMIT 1`,
    [userId, roleSlug]
  );
}

function parseResponsible(responsible: string | null) {
  const activeServices = { MSC: true, RREO: true, RGF: true, DCA: true, SIOPE: true, SIOPS: true };
  try {
    if (responsible && responsible.startsWith('{')) {
      const parsed = JSON.parse(responsible);
      return { ...parsed, _activeServices: parsed._activeServices || activeServices };
    }
  } catch {
    // Fallback to a single responsible for every service.
  }

  const value = responsible === '-' ? '' : (responsible || '');
  return { MSC: value, RREO: value, RGF: value, DCA: value, SIOPE: value, SIOPS: value, _activeServices: activeServices };
}

export async function getUserByEmail(email: string) {
  const [rows] = await pool.query<Row[]>(
    'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [email.trim().toLowerCase()]
  );
  return rows[0] || null;
}

export async function getUserByUid(uid: string) {
  const [rows] = await pool.query<Row[]>(
    'SELECT * FROM users WHERE uid = ? AND deleted_at IS NULL LIMIT 1',
    [uid]
  );
  return mapUser(rows[0] || null);
}

export async function createUser(data: {
  email: string;
  passwordPlain: string;
  name?: string;
  employeeName?: string;
}) {
  const email = data.email.trim().toLowerCase();
  const isAdminEmail = email === 'comercialmetabit@gmail.com';
  const [result] = await pool.query<any>(
    `INSERT INTO users (uid, email, password, name, employee_name)
     VALUES (?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      email,
      await bcrypt.hash(data.passwordPlain, 10),
      data.name || null,
      isAdminEmail ? 'Administrador' : data.employeeName || null,
    ]
  );
  await assignRoleToUser(Number(result.insertId), isAdminEmail ? 'admin' : 'operator');
  const [rows] = await pool.query<Row[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [result.insertId]);
  return mapUser(rows[0] || null);
}

export async function updateUserEmployee(uid: string, employeeName: string | null) {
  await pool.query('UPDATE users SET employee_name = ? WHERE uid = ?', [employeeName, uid]);
  return getUserByUid(uid);
}

export async function getMunicipalities() {
  const [rows] = await pool.query<Row[]>('SELECT * FROM municipalities ORDER BY name');
  return rows.map(mapMunicipality);
}

export async function createMunicipality(data: {
  name: string;
  state: string;
  responsible: string;
  phone: string;
  email: string;
  observations?: string;
}) {
  const [result] = await pool.query<any>(
    `INSERT INTO municipalities (name, state, responsible, phone, email, observations)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.name, data.state, data.responsible, data.phone, data.email, data.observations || null]
  );
  const [rows] = await pool.query<Row[]>('SELECT * FROM municipalities WHERE id = ? LIMIT 1', [result.insertId]);
  return mapMunicipality(rows[0]);
}

export async function updateMunicipality(
  id: number,
  data: {
    name: string;
    state: string;
    responsible: string;
    phone: string;
    email: string;
    observations?: string;
  }
) {
  await pool.query(
    `UPDATE municipalities
     SET name = ?, state = ?, responsible = ?, phone = ?, email = ?, observations = ?
     WHERE id = ?`,
    [data.name, data.state, data.responsible, data.phone, data.email, data.observations || null, id]
  );
  const [rows] = await pool.query<Row[]>('SELECT * FROM municipalities WHERE id = ? LIMIT 1', [id]);
  return mapMunicipality(rows[0]);
}

export async function deleteMunicipality(id: number) {
  const [rows] = await pool.query<Row[]>('SELECT * FROM municipalities WHERE id = ? LIMIT 1', [id]);
  await pool.query('DELETE FROM municipalities WHERE id = ?', [id]);
  return rows[0] ? mapMunicipality(rows[0]) : null;
}

export async function getOrCreateTasks(year: number, obligationCode: string) {
  const competencesList = COMPETENCES[obligationCode] || [];
  const [municipalityRows] = await pool.query<Row[]>('SELECT * FROM municipalities ORDER BY name');
  if (municipalityRows.length === 0 || competencesList.length === 0) {
    return [];
  }

  for (const municipality of municipalityRows) {
    const responsible = parseResponsible(municipality.responsible);
    if (responsible._activeServices?.[obligationCode] === false) {
      continue;
    }

    for (const competence of competencesList) {
      await pool.query(
        `INSERT IGNORE INTO tasks (municipality_id, obligation_code, competence, year, status, siops_membros, siope_folha)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          municipality.id,
          obligationCode,
          competence,
          year,
          'Falta XML',
          obligationCode === 'SIOPS' ? 'Não Solicitado' : null,
          obligationCode === 'SIOPE' ? 'Não Solicitado' : null,
        ]
      );
    }
  }

  const [taskRows] = await pool.query<Row[]>(
    'SELECT * FROM tasks WHERE year = ? AND obligation_code = ? ORDER BY municipality_id, id',
    [year, obligationCode]
  );
  const municipalitiesById = new Map(municipalityRows.map((municipality) => [Number(municipality.id), municipality]));
  return taskRows
    .map(mapTask)
    .filter((task) => {
      const municipality = municipalitiesById.get(task.municipalityId);
      if (!municipality) return false;
      const responsible = parseResponsible(municipality.responsible);
      return responsible._activeServices?.[obligationCode] !== false;
    });
}

async function fetchTask(connection: any, taskId: number) {
  const [rows] = await connection.query('SELECT * FROM tasks WHERE id = ? LIMIT 1', [taskId]);
  return rows[0] || null;
}

async function insertHistory(connection: any, taskId: number, fieldChanged: string, oldValue: string | null, newValue: string | null, userWhoChanged?: string | null, observation?: string | null) {
  await connection.query(
    `INSERT INTO history (task_id, field_changed, old_value, new_value, user_who_changed, observation)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [taskId, fieldChanged, oldValue, newValue, userWhoChanged || null, observation || null]
  );
}

async function ensureTaskStatus(
  connection: any,
  municipalityId: number,
  obligationCode: string,
  competence: string,
  year: number,
  newStatus: string,
  userWhoChanged: string | undefined,
  observation: string | undefined,
  currentTaskId?: number,
  currentUpdate: Record<string, any> = {}
) {
  const [rows] = await connection.query(
    'SELECT * FROM tasks WHERE municipality_id = ? AND obligation_code = ? AND competence = ? AND year = ? LIMIT 1',
    [municipalityId, obligationCode, competence, year]
  );
  const task = rows[0];

  if (task) {
    const taskId = Number(task.id);
    if (currentTaskId && taskId === currentTaskId) {
      if (task.status !== newStatus) {
        currentUpdate.status = newStatus;
        await insertHistory(connection, taskId, 'status', task.status, newStatus, userWhoChanged, observation);
      }
      return;
    }

    if (task.status === 'Falta XML') {
      await connection.query('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newStatus, taskId]);
      await insertHistory(connection, taskId, 'status', task.status, newStatus, userWhoChanged, observation);
    }
    return;
  }

  const [result] = await connection.query(
    `INSERT INTO tasks (municipality_id, obligation_code, competence, year, status, siops_membros, siope_folha)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      municipalityId,
      obligationCode,
      competence,
      year,
      newStatus,
      obligationCode === 'SIOPS' ? 'Não Solicitado' : null,
      obligationCode === 'SIOPE' ? 'Não Solicitado' : null,
    ]
  );
  await insertHistory(connection, Number(result.insertId), 'status', 'Falta XML', newStatus, userWhoChanged, observation);
}

export async function updateTaskDetails(
  taskId: number,
  data: {
    status?: string;
    siopsMembros?: string;
    siopeFolha?: string;
    userWhoChanged?: string;
    observation?: string;
  }
) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const current = await fetchTask(connection, taskId);
    if (!current) {
      throw new Error(`Task with ID ${taskId} not found`);
    }

    const currentUpdate: Record<string, any> = {};
    const isFromMissingToStarted = current.status === 'Falta XML' && (data.status === 'Não iniciado' || data.status === 'Não Iniciado');

    if (isFromMissingToStarted) {
      for (const code of Object.keys(COMPETENCES)) {
        if (COMPETENCES[code].includes(current.competence)) {
          await ensureTaskStatus(connection, Number(current.municipality_id), code, current.competence, Number(current.year), 'Não iniciado', data.userWhoChanged, data.observation, taskId, currentUpdate);
        }
      }

      const monthToBimester: Record<string, string> = {
        'Fevereiro': '1º Bimestre',
        'Abril': '2º Bimestre',
        'Junho': '3º Bimestre',
        'Agosto': '4º Bimestre',
        'Outubro': '5º Bimestre',
        'Dezembro': '6º Bimestre',
      };
      const targetBimester = monthToBimester[current.competence];
      if (targetBimester) {
        for (const code of ['RREO', 'SIOPE', 'SIOPS']) {
          await ensureTaskStatus(connection, Number(current.municipality_id), code, targetBimester, Number(current.year), 'Não iniciado', data.userWhoChanged, data.observation);
        }
      }

      const monthToQuadrimester: Record<string, string> = {
        'Abril': '1º Quadrimestre',
        'Agosto': '2º Quadrimestre',
        'Dezembro': '3º Quadrimestre',
      };
      const targetQuadrimester = monthToQuadrimester[current.competence];
      if (targetQuadrimester) {
        await ensureTaskStatus(connection, Number(current.municipality_id), 'RGF', targetQuadrimester, Number(current.year), 'Não iniciado', data.userWhoChanged, data.observation);
      }

      if (current.competence === 'Encerramento') {
        await ensureTaskStatus(connection, Number(current.municipality_id), 'DCA', 'Anual', Number(current.year), 'Não iniciado', data.userWhoChanged, data.observation);
      }
    } else if (data.status !== undefined && data.status !== current.status) {
      currentUpdate.status = data.status;
      await insertHistory(connection, taskId, 'status', current.status, data.status, data.userWhoChanged, data.observation);
    }

    if (data.siopsMembros !== undefined && data.siopsMembros !== current.siops_membros) {
      currentUpdate.siops_membros = data.siopsMembros;
      await insertHistory(connection, taskId, 'siopsMembros', current.siops_membros, data.siopsMembros, data.userWhoChanged, data.observation);
    }

    if (data.siopeFolha !== undefined && data.siopeFolha !== current.siope_folha) {
      currentUpdate.siope_folha = data.siopeFolha;
      await insertHistory(connection, taskId, 'siopeFolha', current.siope_folha, data.siopeFolha, data.userWhoChanged, data.observation);
    }

    if (Object.keys(currentUpdate).length > 0) {
      const allowedFields = ['status', 'siops_membros', 'siope_folha'];
      const fields = Object.keys(currentUpdate).filter((field) => allowedFields.includes(field));
      const values = fields.map((field) => currentUpdate[field]);
      await connection.query(
        `UPDATE tasks SET ${fields.map((field) => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [...values, taskId]
      );
    }

    await connection.commit();
    const updated = await fetchTask(connection, taskId);
    return mapTask(updated);
  } catch (error) {
    await connection.rollback();
    console.error('Error in updateTaskDetails:', error);
    throw new Error('Database task update transaction failed.', { cause: error });
  } finally {
    connection.release();
  }
}

export async function getTaskHistory(taskId: number) {
  const [rows] = await pool.query<Row[]>('SELECT * FROM history WHERE task_id = ? ORDER BY created_at', [taskId]);
  return rows.map(mapHistory);
}

export async function updateHistoryEntry(id: number, data: {
  oldValue?: string | null;
  newValue?: string | null;
  userWhoChanged?: string | null;
  observation?: string | null;
}) {
  const [existingRows] = await pool.query<Row[]>('SELECT * FROM history WHERE id = ? LIMIT 1', [id]);
  const existing = existingRows[0];
  if (!existing) {
    throw new Error(`History entry with ID ${id} not found.`);
  }

  await pool.query(
    'UPDATE history SET old_value = ?, new_value = ?, user_who_changed = ?, observation = ? WHERE id = ?',
    [data.oldValue, data.newValue, data.userWhoChanged, data.observation, id]
  );

  const fieldMap: Record<string, string> = {
    status: 'status',
    siopsMembros: 'siops_membros',
    siopeFolha: 'siope_folha',
  };
  const taskColumn = fieldMap[existing.field_changed];
  if (taskColumn && data.newValue) {
    await pool.query(`UPDATE tasks SET ${taskColumn} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [data.newValue, existing.task_id]);
  }

  const [rows] = await pool.query<Row[]>('SELECT * FROM history WHERE id = ? LIMIT 1', [id]);
  return mapHistory(rows[0]);
}

export async function getTaskComments(taskId: number) {
  const [rows] = await pool.query<Row[]>('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at', [taskId]);
  return rows.map(mapComment);
}

export async function addTaskComment(taskId: number, authorName: string, text: string) {
  const [result] = await pool.query<any>(
    'INSERT INTO comments (task_id, author_name, text) VALUES (?, ?, ?)',
    [taskId, authorName, text]
  );
  const [rows] = await pool.query<Row[]>('SELECT * FROM comments WHERE id = ? LIMIT 1', [result.insertId]);
  return mapComment(rows[0]);
}

export async function getTaskAttachments(taskId: number) {
  const [rows] = await pool.query<Row[]>('SELECT * FROM attachments WHERE task_id = ? ORDER BY uploaded_at', [taskId]);
  return rows.map(mapAttachment);
}

export async function addAttachment(data: {
  taskId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string;
}) {
  const [result] = await pool.query<any>(
    `INSERT INTO attachments (task_id, file_name, file_type, file_size, file_data)
     VALUES (?, ?, ?, ?, ?)`,
    [data.taskId, data.fileName, data.fileType, data.fileSize, data.fileData]
  );
  const [rows] = await pool.query<Row[]>('SELECT * FROM attachments WHERE id = ? LIMIT 1', [result.insertId]);
  return mapAttachment(rows[0]);
}

export async function getAttachmentById(id: number) {
  const [rows] = await pool.query<Row[]>('SELECT * FROM attachments WHERE id = ? LIMIT 1', [id]);
  return rows[0] ? mapAttachment(rows[0]) : null;
}

export async function getAllTasksForStats() {
  const [rows] = await pool.query<Row[]>('SELECT * FROM tasks');
  return rows.map(mapTask);
}

export async function getAllHistory() {
  const [rows] = await pool.query<Row[]>('SELECT * FROM history');
  return rows.map(mapHistory);
}
