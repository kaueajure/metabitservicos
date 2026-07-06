import { eq, and, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { users, municipalities, tasks, history, comments, attachments } from './schema.ts';
import { COMPETENCES } from '../types.ts';
import bcrypt from 'bcryptjs';
import { readLocalDb, writeLocalDb } from './jsonDb.ts';

let useLocalFallback = false;
let checkPromise: Promise<boolean> | null = null;

export async function isDbAvailable(): Promise<boolean> {
  if (checkPromise) return checkPromise;
  
  checkPromise = (async () => {
    try {
      const timeout = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Connection check timeout')), 1200)
      );
      await Promise.race([
        db.execute(sql`SELECT 1`),
        timeout
      ]);
      console.log('✅ Connected to MySQL database successfully.');
      useLocalFallback = false;
      return true;
    } catch (err: any) {
      // Gracefully switch to local JSON database storage fallback
      useLocalFallback = true;
      return false;
    }
  })();
  
  return checkPromise;
}

// Custom Auth Helpers
export async function getUserByEmail(email: string) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      return local.users.find(u => u.email === email.trim().toLowerCase()) || null;
    }
    const result = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error in getUserByEmail:', error);
    // Dynamic runtime fallback in case it fails after initial check
    try {
      const local = readLocalDb();
      return local.users.find(u => u.email === email.trim().toLowerCase()) || null;
    } catch (e) {
      return null;
    }
  }
}

export async function getUserByUid(uid: string) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      return local.users.find(u => u.uid === uid) || null;
    }
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error in getUserByUid:', error);
    try {
      const local = readLocalDb();
      return local.users.find(u => u.uid === uid) || null;
    } catch (e) {
      return null;
    }
  }
}

export async function createUser(data: {
  email: string;
  passwordPlain: string;
  name?: string;
  employeeName?: string;
}) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const hashedPassword = await bcrypt.hash(data.passwordPlain, 10);
      const uid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const newUser = {
        id: local.users.length > 0 ? Math.max(...local.users.map(u => u.id)) + 1 : 1,
        uid,
        email: data.email.trim().toLowerCase(),
        password: hashedPassword,
        name: data.name || null,
        employeeName: data.employeeName || null,
        createdAt: new Date().toISOString(),
      };
      local.users.push(newUser);
      writeLocalDb(local);
      return newUser;
    }
    const hashedPassword = await bcrypt.hash(data.passwordPlain, 10);
    const uid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const result = await db.insert(users).values({
      uid,
      email: data.email.trim().toLowerCase(),
      password: hashedPassword,
      name: data.name || null,
      employeeName: data.employeeName || null,
    });
    
    const insertId = (result[0] as any).insertId;
    const inserted = await db.select().from(users).where(eq(users.id, insertId)).limit(1);
    return inserted[0];
  } catch (error) {
    console.error('Error in createUser:', error);
    // Try local save
    try {
      const local = readLocalDb();
      const hashedPassword = await bcrypt.hash(data.passwordPlain, 10);
      const uid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const newUser = {
        id: local.users.length > 0 ? Math.max(...local.users.map(u => u.id)) + 1 : 1,
        uid,
        email: data.email.trim().toLowerCase(),
        password: hashedPassword,
        name: data.name || null,
        employeeName: data.employeeName || null,
        createdAt: new Date().toISOString(),
      };
      local.users.push(newUser);
      writeLocalDb(local);
      return newUser;
    } catch (e) {
      throw error;
    }
  }
}

// User helper (compatibility & sync)
export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const isMetabit = email.trim().toLowerCase() === 'comercialmetabit@gmail.com';
    const defaultEmployee = isMetabit ? 'Administrador' : null;

    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const existingIdx = local.users.findIndex(u => u.uid === uid);
      if (existingIdx >= 0) {
        local.users[existingIdx].email = email;
        local.users[existingIdx].name = name || null;
        local.users[existingIdx].employeeName = isMetabit ? 'Administrador' : local.users[existingIdx].employeeName || defaultEmployee;
        writeLocalDb(local);
        return local.users[existingIdx];
      } else {
        const defaultPasswordHash = await bcrypt.hash('admin', 10);
        const newUser = {
          id: local.users.length > 0 ? Math.max(...local.users.map(u => u.id)) + 1 : 1,
          uid,
          email: email.trim().toLowerCase(),
          password: defaultPasswordHash,
          name: name || null,
          employeeName: defaultEmployee,
          createdAt: new Date().toISOString(),
        };
        local.users.push(newUser);
        writeLocalDb(local);
        return newUser;
      }
    }

    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      await db.update(users)
        .set({
          email: email,
          name: name || null,
          employeeName: isMetabit ? 'Administrador' : existing[0].employeeName || defaultEmployee,
        })
        .where(eq(users.uid, uid));
      const updated = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
      return updated[0];
    } else {
      const defaultPasswordHash = await bcrypt.hash('admin', 10);
      const result = await db.insert(users)
        .values({
          uid,
          email: email.trim().toLowerCase(),
          password: defaultPasswordHash,
          name: name || null,
          employeeName: defaultEmployee,
        });
      const insertId = (result[0] as any).insertId;
      const inserted = await db.select().from(users).where(eq(users.id, insertId)).limit(1);
      return inserted[0];
    }
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    try {
      const isMetabit = email.trim().toLowerCase() === 'comercialmetabit@gmail.com';
      const defaultEmployee = isMetabit ? 'Administrador' : null;
      const local = readLocalDb();
      const existingIdx = local.users.findIndex(u => u.uid === uid);
      if (existingIdx >= 0) {
        local.users[existingIdx].email = email;
        local.users[existingIdx].name = name || null;
        local.users[existingIdx].employeeName = isMetabit ? 'Administrador' : local.users[existingIdx].employeeName || defaultEmployee;
        writeLocalDb(local);
        return local.users[existingIdx];
      } else {
        const defaultPasswordHash = await bcrypt.hash('admin', 10);
        const newUser = {
          id: local.users.length > 0 ? Math.max(...local.users.map(u => u.id)) + 1 : 1,
          uid,
          email: email.trim().toLowerCase(),
          password: defaultPasswordHash,
          name: name || null,
          employeeName: defaultEmployee,
          createdAt: new Date().toISOString(),
        };
        local.users.push(newUser);
        writeLocalDb(local);
        return newUser;
      }
    } catch (e) {
      throw new Error('Database operation failed.', { cause: error });
    }
  }
}

export async function updateUserEmployee(uid: string, employeeName: string | null) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const idx = local.users.findIndex(u => u.uid === uid);
      if (idx >= 0) {
        local.users[idx].employeeName = employeeName;
        writeLocalDb(local);
        return local.users[idx];
      }
      return null;
    }
    await db.update(users)
      .set({ employeeName })
      .where(eq(users.uid, uid));
    const updated = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return updated[0];
  } catch (error) {
    console.error('Error in updateUserEmployee:', error);
    try {
      const local = readLocalDb();
      const idx = local.users.findIndex(u => u.uid === uid);
      if (idx >= 0) {
        local.users[idx].employeeName = employeeName;
        writeLocalDb(local);
        return local.users[idx];
      }
      return null;
    } catch (e) {
      throw new Error('Database operation failed.', { cause: error });
    }
  }
}

// Municipalities helpers
export async function getMunicipalities() {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      return [...local.municipalities].sort((a, b) => a.name.localeCompare(b.name));
    }
    return await db.select().from(municipalities).orderBy(municipalities.name);
  } catch (error) {
    console.error('Error in getMunicipalities:', error);
    try {
      const local = readLocalDb();
      return [...local.municipalities].sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
      throw new Error('Database query failed.', { cause: error });
    }
  }
}

export async function createMunicipality(data: {
  name: string;
  state: string;
  responsible: string;
  phone: string;
  email: string;
  observations?: string;
}) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const newMun = {
        id: local.municipalities.length > 0 ? Math.max(...local.municipalities.map(m => m.id)) + 1 : 1,
        name: data.name,
        state: data.state,
        responsible: data.responsible,
        phone: data.phone,
        email: data.email,
        observations: data.observations || null,
        createdAt: new Date().toISOString(),
      };
      local.municipalities.push(newMun);
      writeLocalDb(local);
      return newMun;
    }
    const result = await db.insert(municipalities)
      .values({
        name: data.name,
        state: data.state,
        responsible: data.responsible,
        phone: data.phone,
        email: data.email,
        observations: data.observations || null,
      });
    const insertId = (result[0] as any).insertId;
    const inserted = await db.select().from(municipalities).where(eq(municipalities.id, insertId)).limit(1);
    return inserted[0];
  } catch (error) {
    console.error('Error in createMunicipality:', error);
    try {
      const local = readLocalDb();
      const newMun = {
        id: local.municipalities.length > 0 ? Math.max(...local.municipalities.map(m => m.id)) + 1 : 1,
        name: data.name,
        state: data.state,
        responsible: data.responsible,
        phone: data.phone,
        email: data.email,
        observations: data.observations || null,
        createdAt: new Date().toISOString(),
      };
      local.municipalities.push(newMun);
      writeLocalDb(local);
      return newMun;
    } catch (e) {
      throw new Error('Database insert failed.', { cause: error });
    }
  }
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
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const idx = local.municipalities.findIndex(m => m.id === id);
      if (idx >= 0) {
        local.municipalities[idx] = {
          ...local.municipalities[idx],
          name: data.name,
          state: data.state,
          responsible: data.responsible,
          phone: data.phone,
          email: data.email,
          observations: data.observations || null,
        };
        writeLocalDb(local);
        return local.municipalities[idx];
      }
      return null;
    }
    await db.update(municipalities)
      .set({
        name: data.name,
        state: data.state,
        responsible: data.responsible,
        phone: data.phone,
        email: data.email,
        observations: data.observations || null,
      })
      .where(eq(municipalities.id, id));
    const updated = await db.select().from(municipalities).where(eq(municipalities.id, id)).limit(1);
    return updated[0];
  } catch (error) {
    console.error('Error in updateMunicipality:', error);
    try {
      const local = readLocalDb();
      const idx = local.municipalities.findIndex(m => m.id === id);
      if (idx >= 0) {
        local.municipalities[idx] = {
          ...local.municipalities[idx],
          name: data.name,
          state: data.state,
          responsible: data.responsible,
          phone: data.phone,
          email: data.email,
          observations: data.observations || null,
        };
        writeLocalDb(local);
        return local.municipalities[idx];
      }
      return null;
    } catch (e) {
      throw new Error('Database update failed.', { cause: error });
    }
  }
}

export async function deleteMunicipality(id: number) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const idx = local.municipalities.findIndex(m => m.id === id);
      if (idx >= 0) {
        const removed = local.municipalities.splice(idx, 1)[0];
        const taskIds = local.tasks.filter(t => t.municipalityId === id).map(t => t.id);
        local.tasks = local.tasks.filter(t => t.municipalityId !== id);
        local.comments = local.comments.filter(c => !taskIds.includes(c.taskId));
        local.attachments = local.attachments.filter(a => !taskIds.includes(a.taskId));
        local.history = local.history.filter(h => !taskIds.includes(h.taskId));
        writeLocalDb(local);
        return removed;
      }
      return null;
    }
    const existing = await db.select().from(municipalities).where(eq(municipalities.id, id)).limit(1);
    await db.delete(municipalities)
      .where(eq(municipalities.id, id));
    return existing[0];
  } catch (error) {
    console.error('Error in deleteMunicipality:', error);
    try {
      const local = readLocalDb();
      const idx = local.municipalities.findIndex(m => m.id === id);
      if (idx >= 0) {
        const removed = local.municipalities.splice(idx, 1)[0];
        const taskIds = local.tasks.filter(t => t.municipalityId === id).map(t => t.id);
        local.tasks = local.tasks.filter(t => t.municipalityId !== id);
        local.comments = local.comments.filter(c => !taskIds.includes(c.taskId));
        local.attachments = local.attachments.filter(a => !taskIds.includes(a.taskId));
        local.history = local.history.filter(h => !taskIds.includes(h.taskId));
        writeLocalDb(local);
        return removed;
      }
      return null;
    } catch (e) {
      throw new Error('Database delete failed.', { cause: error });
    }
  }
}

// Lazy tasks generator and fetcher
export async function getOrCreateTasks(year: number, obligationCode: string) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const muns = local.municipalities;
      const competencesList = COMPETENCES[obligationCode] || [];

      if (muns.length === 0 || competencesList.length === 0) {
        return [];
      }

      const existingTasks = local.tasks.filter(t => t.year === year && t.obligationCode === obligationCode);
      const taskMap = new Map<string, any>();
      for (const t of existingTasks) {
        taskMap.set(`${t.municipalityId}_${t.competence}`, t);
      }

      let changed = false;
      let nextId = local.tasks.length > 0 ? Math.max(...local.tasks.map(t => t.id)) + 1 : 1;

      for (const mun of muns) {
        try {
          if (mun.responsible && mun.responsible.startsWith('{')) {
            const parsed = JSON.parse(mun.responsible);
            if (parsed._activeServices && parsed._activeServices[obligationCode] === false) {
              continue;
            }
          }
        } catch (e) {
          // ignore
        }

        for (const comp of competencesList) {
          const key = `${mun.id}_${comp}`;
          if (!taskMap.has(key)) {
            const newTask = {
              id: nextId++,
              municipalityId: mun.id,
              obligationCode,
              competence: comp,
              year,
              status: 'Falta XML',
              siopsMembros: obligationCode === 'SIOPS' ? 'Não Solicitado' : null,
              siopeFolha: obligationCode === 'SIOPE' ? 'Não Solicitado' : null,
              updatedAt: new Date().toISOString(),
            };
            local.tasks.push(newTask);
            changed = true;
          }
        }
      }

      if (changed) {
        writeLocalDb(local);
      }

      const allFetched = local.tasks.filter(t => t.year === year && t.obligationCode === obligationCode);
      return allFetched.filter(t => {
        const mun = muns.find(m => m.id === t.municipalityId);
        if (!mun) return false;
        try {
          if (mun.responsible && mun.responsible.startsWith('{')) {
            const parsed = JSON.parse(mun.responsible);
            if (parsed._activeServices && parsed._activeServices[obligationCode] === false) {
              return false;
            }
          }
        } catch (e) {
          // ignore
        }
        return true;
      });
    }

    // 1. Get all municipalities
    const muns = await db.select().from(municipalities);
    const competencesList = COMPETENCES[obligationCode] || [];

    if (muns.length === 0 || competencesList.length === 0) {
      return [];
    }

    // 2. Get existing tasks for this year & obligation
    const existingTasks = await db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.year, year),
          eq(tasks.obligationCode, obligationCode)
        )
      );

    // Create a lookup map for existing tasks: municipalityId + competence
    const taskMap = new Map<string, typeof tasks.$inferSelect>();
    for (const t of existingTasks) {
      taskMap.set(`${t.municipalityId}_${t.competence}`, t);
    }

    const tasksToInsert: (typeof tasks.$inferInsert)[] = [];

    for (const mun of muns) {
      // Skip if this obligation is inactive for this municipality
      try {
        if (mun.responsible && mun.responsible.startsWith('{')) {
          const parsed = JSON.parse(mun.responsible);
          if (parsed._activeServices && parsed._activeServices[obligationCode] === false) {
            continue;
          }
        }
      } catch (e) {
        // ignore
      }

      for (const comp of competencesList) {
        const key = `${mun.id}_${comp}`;
        if (!taskMap.has(key)) {
          tasksToInsert.push({
            municipalityId: mun.id,
            obligationCode,
            competence: comp,
            year,
            status: 'Falta XML',
            siopsMembros: obligationCode === 'SIOPS' ? 'Não Solicitado' : null,
            siopeFolha: obligationCode === 'SIOPE' ? 'Não Solicitado' : null,
          });
        }
      }
    }

    // 3. Batch insert missing tasks
    if (tasksToInsert.length > 0) {
      await db.insert(tasks).values(tasksToInsert);
    }

    // 4. Fetch and return complete set of tasks
    const allFetched = await db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.year, year),
          eq(tasks.obligationCode, obligationCode)
        )
      );

    // Filter returned tasks to only active ones
    return allFetched.filter(t => {
      const mun = muns.find(m => m.id === t.municipalityId);
      if (!mun) return false;
      try {
        if (mun.responsible && mun.responsible.startsWith('{')) {
          const parsed = JSON.parse(mun.responsible);
          if (parsed._activeServices && parsed._activeServices[obligationCode] === false) {
            return false;
          }
        }
      } catch (e) {
        // ignore
      }
      return true;
    });
  } catch (error) {
    console.error('Error in getOrCreateTasks:', error);
    try {
      const local = readLocalDb();
      const muns = local.municipalities;
      const competencesList = COMPETENCES[obligationCode] || [];

      if (muns.length === 0 || competencesList.length === 0) {
        return [];
      }

      const existingTasks = local.tasks.filter(t => t.year === year && t.obligationCode === obligationCode);
      const taskMap = new Map<string, any>();
      for (const t of existingTasks) {
        taskMap.set(`${t.municipalityId}_${t.competence}`, t);
      }

      let changed = false;
      let nextId = local.tasks.length > 0 ? Math.max(...local.tasks.map(t => t.id)) + 1 : 1;

      for (const mun of muns) {
        try {
          if (mun.responsible && mun.responsible.startsWith('{')) {
            const parsed = JSON.parse(mun.responsible);
            if (parsed._activeServices && parsed._activeServices[obligationCode] === false) {
              continue;
            }
          }
        } catch (e) {
          // ignore
        }

        for (const comp of competencesList) {
          const key = `${mun.id}_${comp}`;
          if (!taskMap.has(key)) {
            const newTask = {
              id: nextId++,
              municipalityId: mun.id,
              obligationCode,
              competence: comp,
              year,
              status: 'Falta XML',
              siopsMembros: obligationCode === 'SIOPS' ? 'Não Solicitado' : null,
              siopeFolha: obligationCode === 'SIOPE' ? 'Não Solicitado' : null,
              updatedAt: new Date().toISOString(),
            };
            local.tasks.push(newTask);
            changed = true;
          }
        }
      }

      if (changed) {
        writeLocalDb(local);
      }

      const allFetched = local.tasks.filter(t => t.year === year && t.obligationCode === obligationCode);
      return allFetched.filter(t => {
        const mun = muns.find(m => m.id === t.municipalityId);
        if (!mun) return false;
        try {
          if (mun.responsible && mun.responsible.startsWith('{')) {
            const parsed = JSON.parse(mun.responsible);
            if (parsed._activeServices && parsed._activeServices[obligationCode] === false) {
              return false;
            }
          }
        } catch (e) {
          // ignore
        }
        return true;
      });
    } catch (e) {
      throw new Error('Database fetch/generate tasks failed.', { cause: error });
    }
  }
}

// Update task status and record history
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
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const currentIdx = local.tasks.findIndex(t => t.id === taskId);
      if (currentIdx === -1) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      const current = local.tasks[currentIdx];

      const historyInserts: any[] = [];
      let nextHistId = local.history.length > 0 ? Math.max(...local.history.map(h => h.id)) + 1 : 1;

      const isFromFaltaXmlToNaoIniciado =
        current.status === 'Falta XML' &&
        (data.status === 'Não iniciado' || data.status === 'Não Iniciado');

      const nowStr = new Date().toISOString();

      if (isFromFaltaXmlToNaoIniciado) {
        const compatibleObligations = Object.keys(COMPETENCES).filter(code =>
          COMPETENCES[code].includes(current.competence)
        );

        const existingSiblingTasks = local.tasks.filter(t =>
          t.municipalityId === current.municipalityId &&
          t.competence === current.competence &&
          t.year === current.year
        );

        const siblingMap = new Map<string, any>();
        for (const st of existingSiblingTasks) {
          siblingMap.set(st.obligationCode, st);
        }

        let nextTaskId = local.tasks.length > 0 ? Math.max(...local.tasks.map(t => t.id)) + 1 : 1;

        for (const obl of compatibleObligations) {
          const sibling = siblingMap.get(obl);
          if (sibling) {
            if (sibling.id === taskId) {
              local.tasks[currentIdx].status = 'Não iniciado';
              local.tasks[currentIdx].updatedAt = nowStr;
              historyInserts.push({
                id: nextHistId++,
                taskId: sibling.id,
                fieldChanged: 'status',
                oldValue: sibling.status,
                newValue: 'Não iniciado',
                userWhoChanged: data.userWhoChanged || null,
                observation: data.observation || null,
                createdAt: nowStr,
              });
            } else {
              if (sibling.status === 'Falta XML') {
                const sIdx = local.tasks.findIndex(t => t.id === sibling.id);
                local.tasks[sIdx].status = 'Não iniciado';
                local.tasks[sIdx].updatedAt = nowStr;
                historyInserts.push({
                  id: nextHistId++,
                  taskId: sibling.id,
                  fieldChanged: 'status',
                  oldValue: sibling.status,
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                  createdAt: nowStr,
                });
              }
            }
          } else {
            const newSibling = {
              id: nextTaskId++,
              municipalityId: current.municipalityId,
              obligationCode: obl,
              competence: current.competence,
              year: current.year,
              status: 'Não iniciado',
              siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
              siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
              updatedAt: nowStr,
            };
            local.tasks.push(newSibling);
            historyInserts.push({
              id: nextHistId++,
              taskId: newSibling.id,
              fieldChanged: 'status',
              oldValue: 'Falta XML',
              newValue: 'Não iniciado',
              userWhoChanged: data.userWhoChanged || null,
              observation: data.observation || null,
              createdAt: nowStr,
            });
          }
        }

        const MONTH_TO_BIMESTRE: Record<string, string> = {
          'Fevereiro': '1º Bimestre',
          'Abril': '2º Bimestre',
          'Junho': '3º Bimestre',
          'Agosto': '4º Bimestre',
          'Outubro': '5º Bimestre',
          'Dezembro': '6º Bimestre',
        };

        const targetBimestre = MONTH_TO_BIMESTRE[current.competence];
        if (targetBimestre) {
          const targetObligations = ['RREO', 'SIOPE', 'SIOPS'];
          const existingBimestreTasks = local.tasks.filter(t =>
            t.municipalityId === current.municipalityId &&
            t.competence === targetBimestre &&
            t.year === current.year
          );
          const bimestreTaskMap = new Map<string, any>();
          for (const bt of existingBimestreTasks) {
            bimestreTaskMap.set(bt.obligationCode, bt);
          }

          let nextTaskId = local.tasks.length > 0 ? Math.max(...local.tasks.map(t => t.id)) + 1 : 1;

          for (const obl of targetObligations) {
            const btTask = bimestreTaskMap.get(obl);
            if (btTask) {
              if (btTask.status === 'Falta XML') {
                const sIdx = local.tasks.findIndex(t => t.id === btTask.id);
                local.tasks[sIdx].status = 'Não iniciado';
                local.tasks[sIdx].updatedAt = nowStr;
                historyInserts.push({
                  id: nextHistId++,
                  taskId: btTask.id,
                  fieldChanged: 'status',
                  oldValue: btTask.status,
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                  createdAt: nowStr,
                });
              }
            } else {
              const newBtTask = {
                id: nextTaskId++,
                municipalityId: current.municipalityId,
                obligationCode: obl,
                competence: targetBimestre,
                year: current.year,
                status: 'Não iniciado',
                siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                updatedAt: nowStr,
              };
              local.tasks.push(newBtTask);
              historyInserts.push({
                id: nextHistId++,
                taskId: newBtTask.id,
                fieldChanged: 'status',
                oldValue: 'Falta XML',
                newValue: 'Não iniciado',
                userWhoChanged: data.userWhoChanged || null,
                observation: data.observation || null,
                createdAt: nowStr,
              });
            }
          }
        }

        const MONTH_TO_QUADRIMESTRE: Record<string, string> = {
          'Abril': '1º Quadrimestre',
          'Agosto': '2º Quadrimestre',
          'Dezembro': '3º Quadrimestre',
        };

        const targetQuadrimestre = MONTH_TO_QUADRIMESTRE[current.competence];
        if (targetQuadrimestre) {
          const targetObligations = ['RGF'];
          const existingQuadrimestreTasks = local.tasks.filter(t =>
            t.municipalityId === current.municipalityId &&
            t.competence === targetQuadrimestre &&
            t.year === current.year
          );
          const quadrimestreTaskMap = new Map<string, any>();
          for (const qt of existingQuadrimestreTasks) {
            quadrimestreTaskMap.set(qt.obligationCode, qt);
          }

          let nextTaskId = local.tasks.length > 0 ? Math.max(...local.tasks.map(t => t.id)) + 1 : 1;

          for (const obl of targetObligations) {
            const qtTask = quadrimestreTaskMap.get(obl);
            if (qtTask) {
              if (qtTask.status === 'Falta XML') {
                const sIdx = local.tasks.findIndex(t => t.id === qtTask.id);
                local.tasks[sIdx].status = 'Não iniciado';
                local.tasks[sIdx].updatedAt = nowStr;
                historyInserts.push({
                  id: nextHistId++,
                  taskId: qtTask.id,
                  fieldChanged: 'status',
                  oldValue: qtTask.status,
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                  createdAt: nowStr,
                });
              }
            } else {
              const newQtTask = {
                id: nextTaskId++,
                municipalityId: current.municipalityId,
                obligationCode: obl,
                competence: targetQuadrimestre,
                year: current.year,
                status: 'Não iniciado',
                siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                updatedAt: nowStr,
              };
              local.tasks.push(newQtTask);
              historyInserts.push({
                id: nextHistId++,
                taskId: newQtTask.id,
                fieldChanged: 'status',
                oldValue: 'Falta XML',
                newValue: 'Não iniciado',
                userWhoChanged: data.userWhoChanged || null,
                observation: data.observation || null,
                createdAt: nowStr,
              });
            }
          }
        }

        const MONTH_TO_ANUAL: Record<string, string> = {
          'Encerramento': 'Anual',
        };

        const targetAnual = MONTH_TO_ANUAL[current.competence];
        if (targetAnual) {
          const targetObligations = ['DCA'];
          const existingAnualTasks = local.tasks.filter(t =>
            t.municipalityId === current.municipalityId &&
            t.competence === targetAnual &&
            t.year === current.year
          );
          const anualTaskMap = new Map<string, any>();
          for (const at of existingAnualTasks) {
            anualTaskMap.set(at.obligationCode, at);
          }

          let nextTaskId = local.tasks.length > 0 ? Math.max(...local.tasks.map(t => t.id)) + 1 : 1;

          for (const obl of targetObligations) {
            const atTask = anualTaskMap.get(obl);
            if (atTask) {
              if (atTask.status === 'Falta XML') {
                const sIdx = local.tasks.findIndex(t => t.id === atTask.id);
                local.tasks[sIdx].status = 'Não iniciado';
                local.tasks[sIdx].updatedAt = nowStr;
                historyInserts.push({
                  id: nextHistId++,
                  taskId: atTask.id,
                  fieldChanged: 'status',
                  oldValue: atTask.status,
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                  createdAt: nowStr,
                });
              }
            } else {
              const newAtTask = {
                id: nextTaskId++,
                municipalityId: current.municipalityId,
                obligationCode: obl,
                competence: targetAnual,
                year: current.year,
                status: 'Não iniciado',
                siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                updatedAt: nowStr,
              };
              local.tasks.push(newAtTask);
              historyInserts.push({
                id: nextHistId++,
                taskId: newAtTask.id,
                fieldChanged: 'status',
                oldValue: 'Falta XML',
                newValue: 'Não iniciado',
                userWhoChanged: data.userWhoChanged || null,
                observation: data.observation || null,
                createdAt: nowStr,
              });
            }
          }
        }
      } else {
        if (data.status !== undefined && data.status !== current.status) {
          local.tasks[currentIdx].status = data.status;
          historyInserts.push({
            id: nextHistId++,
            taskId,
            fieldChanged: 'status',
            oldValue: current.status,
            newValue: data.status,
            userWhoChanged: data.userWhoChanged || null,
            observation: data.observation || null,
            createdAt: nowStr,
          });
        }
      }

      if (data.siopsMembros !== undefined && data.siopsMembros !== current.siopsMembros) {
        local.tasks[currentIdx].siopsMembros = data.siopsMembros;
        historyInserts.push({
          id: nextHistId++,
          taskId,
          fieldChanged: 'siopsMembros',
          oldValue: current.siopsMembros,
          newValue: data.siopsMembros,
          userWhoChanged: data.userWhoChanged || null,
          observation: data.observation || null,
          createdAt: nowStr,
        });
      }

      if (data.siopeFolha !== undefined && data.siopeFolha !== current.siopeFolha) {
        local.tasks[currentIdx].siopeFolha = data.siopeFolha;
        historyInserts.push({
          id: nextHistId++,
          taskId,
          fieldChanged: 'siopeFolha',
          oldValue: current.siopeFolha,
          newValue: data.siopeFolha,
          userWhoChanged: data.userWhoChanged || null,
          observation: data.observation || null,
          createdAt: nowStr,
        });
      }

      local.tasks[currentIdx].updatedAt = nowStr;

      if (historyInserts.length > 0) {
        local.history.push(...historyInserts);
      }

      writeLocalDb(local);
      return local.tasks[currentIdx];
    }

    return await db.transaction(async (tx) => {
      // Fetch current task first
      const currentTasks = await tx.select().from(tasks).where(eq(tasks.id, taskId));
      if (currentTasks.length === 0) {
        throw new Error(`Task with ID ${taskId} not found`);
      }
      const current = currentTasks[0];

      const historyInserts: (typeof history.$inferInsert)[] = [];
      const updateData: Partial<typeof tasks.$inferSelect> = {
        updatedAt: new Date(),
      };

      const isFromFaltaXmlToNaoIniciado =
        current.status === 'Falta XML' &&
        (data.status === 'Não iniciado' || data.status === 'Não Iniciado');

      if (isFromFaltaXmlToNaoIniciado) {
        // Find all compatible obligation codes for this competence
        const compatibleObligations = Object.keys(COMPETENCES).filter(code =>
          COMPETENCES[code].includes(current.competence)
        );

        // Fetch all existing tasks for this competence, year, and municipality
        const existingSiblingTasks = await tx.select()
          .from(tasks)
          .where(
            and(
              eq(tasks.municipalityId, current.municipalityId),
              eq(tasks.competence, current.competence),
              eq(tasks.year, current.year)
            )
          );

        const siblingMap = new Map<string, typeof tasks.$inferSelect>();
        for (const st of existingSiblingTasks) {
          siblingMap.set(st.obligationCode, st);
        }

        for (const obl of compatibleObligations) {
          const sibling = siblingMap.get(obl);
          if (sibling) {
            // Sibling task exists
            if (sibling.id === taskId) {
              // This is the current task being edited directly
              updateData.status = 'Não iniciado';
              historyInserts.push({
                taskId: sibling.id,
                fieldChanged: 'status',
                oldValue: sibling.status,
                newValue: 'Não iniciado',
                userWhoChanged: data.userWhoChanged || null,
                observation: data.observation || null,
              });
            } else {
              // Only update if it is currently 'Falta XML'
              if (sibling.status === 'Falta XML') {
                await tx.update(tasks)
                  .set({ status: 'Não iniciado', updatedAt: new Date() })
                  .where(eq(tasks.id, sibling.id));

                historyInserts.push({
                  taskId: sibling.id,
                  fieldChanged: 'status',
                  oldValue: sibling.status,
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                });
              }
            }
          } else {
            // Sibling task does not exist, insert it!
            const res = await tx.insert(tasks)
              .values({
                municipalityId: current.municipalityId,
                obligationCode: obl,
                competence: current.competence,
                year: current.year,
                status: 'Não iniciado',
                siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                updatedAt: new Date(),
              });

            const insertId = (res[0] as any).insertId;
            historyInserts.push({
              taskId: insertId,
              fieldChanged: 'status',
              oldValue: 'Falta XML',
              newValue: 'Não iniciado',
              userWhoChanged: data.userWhoChanged || null,
              observation: data.observation || null,
            });
          }
        }

        // Monthly to Bimestre specific automatic transition logic
        const MONTH_TO_BIMESTRE: Record<string, string> = {
          'Fevereiro': '1º Bimestre',
          'Abril': '2º Bimestre',
          'Junho': '3º Bimestre',
          'Agosto': '4º Bimestre',
          'Outubro': '5º Bimestre',
          'Dezembro': '6º Bimestre',
        };

        const targetBimestre = MONTH_TO_BIMESTRE[current.competence];
        if (targetBimestre) {
          const targetObligations = ['RREO', 'SIOPE', 'SIOPS'];
          
          // Fetch existing tasks for this targetBimestre, year, and municipality
          const existingBimestreTasks = await tx.select()
            .from(tasks)
            .where(
              and(
                eq(tasks.municipalityId, current.municipalityId),
                eq(tasks.competence, targetBimestre),
                eq(tasks.year, current.year)
              )
            );

          const bimestreTaskMap = new Map<string, typeof tasks.$inferSelect>();
          for (const bt of existingBimestreTasks) {
            bimestreTaskMap.set(bt.obligationCode, bt);
          }

          for (const obl of targetObligations) {
            const btTask = bimestreTaskMap.get(obl);
            if (btTask) {
              // Task exists, only update if it is currently 'Falta XML'
              if (btTask.status === 'Falta XML') {
                await tx.update(tasks)
                  .set({ status: 'Não iniciado', updatedAt: new Date() })
                  .where(eq(tasks.id, btTask.id));

                historyInserts.push({
                  taskId: btTask.id,
                  fieldChanged: 'status',
                  oldValue: btTask.status,
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                });
              }
            } else {
              // Task does not exist, insert it!
              const res = await tx.insert(tasks)
                .values({
                  municipalityId: current.municipalityId,
                  obligationCode: obl,
                  competence: targetBimestre,
                  year: current.year,
                  status: 'Não iniciado',
                  siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                  siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                  updatedAt: new Date(),
                });

              const insertId = (res[0] as any).insertId;
              historyInserts.push({
                taskId: insertId,
                fieldChanged: 'status',
                oldValue: 'Falta XML',
                newValue: 'Não iniciado',
                userWhoChanged: data.userWhoChanged || null,
                observation: data.observation || null,
              });
            }
          }
        }

        // Monthly to Quadrimestre specific automatic transition logic
        const MONTH_TO_QUADRIMESTRE: Record<string, string> = {
          'Abril': '1º Quadrimestre',
          'Agosto': '2º Quadrimestre',
          'Dezembro': '3º Quadrimestre',
        };

        const targetQuadrimestre = MONTH_TO_QUADRIMESTRE[current.competence];
        if (targetQuadrimestre) {
          const targetObligations = ['RGF'];
          
          // Fetch existing tasks for this targetQuadrimestre, year, and municipality
          const existingQuadrimestreTasks = await tx.select()
            .from(tasks)
            .where(
              and(
                eq(tasks.municipalityId, current.municipalityId),
                eq(tasks.competence, targetQuadrimestre),
                eq(tasks.year, current.year)
              )
            );

          const quadrimestreTaskMap = new Map<string, typeof tasks.$inferSelect>();
          for (const qt of existingQuadrimestreTasks) {
            quadrimestreTaskMap.set(qt.obligationCode, qt);
          }

          for (const obl of targetObligations) {
            const qtTask = quadrimestreTaskMap.get(obl);
            if (qtTask) {
              // Task exists, only update if it is currently 'Falta XML'
              if (qtTask.status === 'Falta XML') {
                await tx.update(tasks)
                  .set({ status: 'Não iniciado', updatedAt: new Date() })
                  .where(eq(tasks.id, qtTask.id));

                historyInserts.push({
                  taskId: qtTask.id,
                  fieldChanged: 'status',
                  oldValue: qtTask.status,
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                });
              }
            } else {
              // Task does not exist, insert it!
              const res = await tx.insert(tasks)
                .values({
                  municipalityId: current.municipalityId,
                  obligationCode: obl,
                  competence: targetQuadrimestre,
                  year: current.year,
                  status: 'Não iniciado',
                  siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                  siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                  updatedAt: new Date(),
                });

              const insertId = (res[0] as any).insertId;
              historyInserts.push({
                taskId: insertId,
                fieldChanged: 'status',
                oldValue: 'Falta XML',
                newValue: 'Não iniciado',
                userWhoChanged: data.userWhoChanged || null,
                observation: data.observation || null,
              });
            }
          }
        }

        // Monthly to Anual specific automatic transition logic
        const MONTH_TO_ANUAL: Record<string, string> = {
          'Encerramento': 'Anual',
        };

        const targetAnual = MONTH_TO_ANUAL[current.competence];
        if (targetAnual) {
          const targetObligations = ['DCA'];
          
          // Fetch existing tasks for this targetAnual, year, and municipality
          const existingAnualTasks = await tx.select()
            .from(tasks)
            .where(
              and(
                eq(tasks.municipalityId, current.municipalityId),
                eq(tasks.competence, targetAnual),
                eq(tasks.year, current.year)
              )
            );

          const anualTaskMap = new Map<string, typeof tasks.$inferSelect>();
          for (const at of existingAnualTasks) {
            anualTaskMap.set(at.obligationCode, at);
          }

          for (const obl of targetObligations) {
            const atTask = anualTaskMap.get(obl);
            if (atTask) {
              // Task exists, only update if it is currently 'Falta XML'
              if (atTask.status === 'Falta XML') {
                await tx.update(tasks)
                  .set({ status: 'Não iniciado', updatedAt: new Date() })
                  .where(eq(tasks.id, atTask.id));

                historyInserts.push({
                  taskId: atTask.id,
                  fieldChanged: 'status',
                  oldValue: atTask.status,
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                });
              }
            } else {
              // Task does not exist, insert it!
              const res = await tx.insert(tasks)
                .values({
                  municipalityId: current.municipalityId,
                  obligationCode: obl,
                  competence: targetAnual,
                  year: current.year,
                  status: 'Não iniciado',
                  siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                  siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                  updatedAt: new Date(),
                });

              const insertId = (res[0] as any).insertId;
              historyInserts.push({
                taskId: insertId,
                fieldChanged: 'status',
                oldValue: 'Falta XML',
                newValue: 'Não iniciado',
                userWhoChanged: data.userWhoChanged || null,
                observation: data.observation || null,
              });
            }
          }
        }
      } else {
        // Standard non-replication behavior
        // Check status change
        if (data.status !== undefined && data.status !== current.status) {
          updateData.status = data.status;
          historyInserts.push({
            taskId,
            fieldChanged: 'status',
            oldValue: current.status,
            newValue: data.status,
            userWhoChanged: data.userWhoChanged || null,
            observation: data.observation || null,
          });
        }
      }

      // Check SIOPS Membros change
      if (data.siopsMembros !== undefined && data.siopsMembros !== current.siopsMembros) {
        updateData.siopsMembros = data.siopsMembros;
        historyInserts.push({
          taskId,
          fieldChanged: 'siopsMembros',
          oldValue: current.siopsMembros,
          newValue: data.siopsMembros,
          userWhoChanged: data.userWhoChanged || null,
          observation: data.observation || null,
        });
      }

      // Check SIOPE Folha change
      if (data.siopeFolha !== undefined && data.siopeFolha !== current.siopeFolha) {
        updateData.siopeFolha = data.siopeFolha;
        historyInserts.push({
          taskId,
          fieldChanged: 'siopeFolha',
          oldValue: current.siopeFolha,
          newValue: data.siopeFolha,
          userWhoChanged: data.userWhoChanged || null,
          observation: data.observation || null,
        });
      }

      // Perform updates for the current task if there are changes
      if (Object.keys(updateData).length > 1) {
        await tx.update(tasks).set(updateData).where(eq(tasks.id, taskId));
      }

      // Record history
      if (historyInserts.length > 0) {
        await tx.insert(history).values(historyInserts);
      }

      const updated = await tx.select().from(tasks).where(eq(tasks.id, taskId));
      return updated[0];
    });
  } catch (error) {
    console.error('Error in updateTaskDetails:', error);
    throw new Error('Database task update transaction failed.', { cause: error });
  }
}

// History fetcher
export async function getTaskHistory(taskId: number) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      return local.history
        .filter(h => h.taskId === taskId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return await db.select()
      .from(history)
      .where(eq(history.taskId, taskId))
      .orderBy(history.createdAt);
  } catch (error) {
    console.error('Error in getTaskHistory:', error);
    try {
      const local = readLocalDb();
      return local.history
        .filter(h => h.taskId === taskId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      throw new Error('Database history query failed.', { cause: error });
    }
  }
}

export async function updateHistoryEntry(id: number, data: {
  oldValue?: string | null;
  newValue?: string | null;
  userWhoChanged?: string | null;
  observation?: string | null;
}) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const idx = local.history.findIndex(h => h.id === id);
      if (idx === -1) {
        throw new Error(`History entry with ID ${id} not found.`);
      }
      const hRecord = local.history[idx];

      local.history[idx] = {
        ...hRecord,
        oldValue: data.oldValue !== undefined ? data.oldValue : hRecord.oldValue,
        newValue: data.newValue !== undefined ? data.newValue : hRecord.newValue,
        userWhoChanged: data.userWhoChanged !== undefined ? data.userWhoChanged : hRecord.userWhoChanged,
        observation: data.observation !== undefined ? data.observation : hRecord.observation,
      };

      if (hRecord.fieldChanged === 'status' && data.newValue) {
        const tIdx = local.tasks.findIndex(t => t.id === hRecord.taskId);
        if (tIdx !== -1) {
          local.tasks[tIdx].status = data.newValue;
          local.tasks[tIdx].updatedAt = new Date().toISOString();
        }
      } else if (hRecord.fieldChanged === 'siopsMembros' && data.newValue) {
        const tIdx = local.tasks.findIndex(t => t.id === hRecord.taskId);
        if (tIdx !== -1) {
          local.tasks[tIdx].siopsMembros = data.newValue;
          local.tasks[tIdx].updatedAt = new Date().toISOString();
        }
      } else if (hRecord.fieldChanged === 'siopeFolha' && data.newValue) {
        const tIdx = local.tasks.findIndex(t => t.id === hRecord.taskId);
        if (tIdx !== -1) {
          local.tasks[tIdx].siopeFolha = data.newValue;
          local.tasks[tIdx].updatedAt = new Date().toISOString();
        }
      }

      writeLocalDb(local);
      return local.history[idx];
    }

    const existing = await db.select().from(history).where(eq(history.id, id)).limit(1);
    if (existing.length === 0) {
      throw new Error(`History entry with ID ${id} not found.`);
    }
    const hRecord = existing[0];

    await db.update(history)
      .set({
        oldValue: data.oldValue,
        newValue: data.newValue,
        userWhoChanged: data.userWhoChanged,
        observation: data.observation,
      })
      .where(eq(history.id, id));

    // Also update the main task with the corrected value in the database
    if (hRecord.fieldChanged === 'status' && data.newValue) {
      await db.update(tasks)
        .set({ status: data.newValue })
        .where(eq(tasks.id, hRecord.taskId));
    } else if (hRecord.fieldChanged === 'siopsMembros' && data.newValue) {
      await db.update(tasks)
        .set({ siopsMembros: data.newValue })
        .where(eq(tasks.id, hRecord.taskId));
    } else if (hRecord.fieldChanged === 'siopeFolha' && data.newValue) {
      await db.update(tasks)
        .set({ siopeFolha: data.newValue })
        .where(eq(tasks.id, hRecord.taskId));
    }

    const updated = await db.select().from(history).where(eq(history.id, id)).limit(1);
    return updated[0];
  } catch (error) {
    console.error('Error in updateHistoryEntry:', error);
    try {
      const local = readLocalDb();
      const idx = local.history.findIndex(h => h.id === id);
      if (idx !== -1) {
        const hRecord = local.history[idx];
        local.history[idx] = {
          ...hRecord,
          oldValue: data.oldValue !== undefined ? data.oldValue : hRecord.oldValue,
          newValue: data.newValue !== undefined ? data.newValue : hRecord.newValue,
          userWhoChanged: data.userWhoChanged !== undefined ? data.userWhoChanged : hRecord.userWhoChanged,
          observation: data.observation !== undefined ? data.observation : hRecord.observation,
        };
        if (hRecord.fieldChanged === 'status' && data.newValue) {
          const tIdx = local.tasks.findIndex(t => t.id === hRecord.taskId);
          if (tIdx !== -1) local.tasks[tIdx].status = data.newValue;
        }
        writeLocalDb(local);
        return local.history[idx];
      }
      throw error;
    } catch (e) {
      throw new Error('Database history update failed.', { cause: error });
    }
  }
}

// Comments helpers
export async function getTaskComments(taskId: number) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      return local.comments
        .filter(c => c.taskId === taskId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return await db.select()
      .from(comments)
      .where(eq(comments.taskId, taskId))
      .orderBy(comments.createdAt);
  } catch (error) {
    console.error('Error in getTaskComments:', error);
    try {
      const local = readLocalDb();
      return local.comments
        .filter(c => c.taskId === taskId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      throw new Error('Database comments query failed.', { cause: error });
    }
  }
}

export async function addTaskComment(taskId: number, authorName: string, text: string) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const nextId = local.comments.length > 0 ? Math.max(...local.comments.map(c => c.id)) + 1 : 1;
      const newComment = {
        id: nextId,
        taskId,
        authorName,
        text,
        createdAt: new Date().toISOString(),
      };
      local.comments.push(newComment);
      writeLocalDb(local);
      return newComment;
    }
    const result = await db.insert(comments)
      .values({
        taskId,
        authorName,
        text,
      });
    const insertId = (result[0] as any).insertId;
    const inserted = await db.select().from(comments).where(eq(comments.id, insertId)).limit(1);
    return inserted[0];
  } catch (error) {
    console.error('Error in addTaskComment:', error);
    try {
      const local = readLocalDb();
      const nextId = local.comments.length > 0 ? Math.max(...local.comments.map(c => c.id)) + 1 : 1;
      const newComment = {
        id: nextId,
        taskId,
        authorName,
        text,
        createdAt: new Date().toISOString(),
      };
      local.comments.push(newComment);
      writeLocalDb(local);
      return newComment;
    } catch (e) {
      throw new Error('Database insert comment failed.', { cause: error });
    }
  }
}

// Attachments helpers
export async function getTaskAttachments(taskId: number) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      return local.attachments
        .filter(a => a.taskId === taskId)
        .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    }
    return await db.select()
      .from(attachments)
      .where(eq(attachments.taskId, taskId))
      .orderBy(attachments.uploadedAt);
  } catch (error) {
    console.error('Error in getTaskAttachments:', error);
    try {
      const local = readLocalDb();
      return local.attachments
        .filter(a => a.taskId === taskId)
        .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    } catch (e) {
      throw new Error('Database attachments query failed.', { cause: error });
    }
  }
}

export async function addAttachment(data: {
  taskId: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string; // Base64
}) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      const nextId = local.attachments.length > 0 ? Math.max(...local.attachments.map(a => a.id)) + 1 : 1;
      const newAttachment = {
        id: nextId,
        taskId: data.taskId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        fileData: data.fileData,
        uploadedAt: new Date().toISOString(),
      };
      local.attachments.push(newAttachment);
      writeLocalDb(local);
      return newAttachment;
    }
    const result = await db.insert(attachments)
      .values({
        taskId: data.taskId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        fileData: data.fileData,
      });
    const insertId = (result[0] as any).insertId;
    const inserted = await db.select().from(attachments).where(eq(attachments.id, insertId)).limit(1);
    return inserted[0];
  } catch (error) {
    console.error('Error in addAttachment:', error);
    try {
      const local = readLocalDb();
      const nextId = local.attachments.length > 0 ? Math.max(...local.attachments.map(a => a.id)) + 1 : 1;
      const newAttachment = {
        id: nextId,
        taskId: data.taskId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        fileData: data.fileData,
        uploadedAt: new Date().toISOString(),
      };
      local.attachments.push(newAttachment);
      writeLocalDb(local);
      return newAttachment;
    } catch (e) {
      throw new Error('Database insert attachment failed.', { cause: error });
    }
  }
}

export async function getAttachmentById(id: number) {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      return local.attachments.find(a => a.id === id) || null;
    }
    const result = await db.select().from(attachments).where(eq(attachments.id, id));
    return result[0] || null;
  } catch (error) {
    console.error('Error in getAttachmentById:', error);
    try {
      const local = readLocalDb();
      return local.attachments.find(a => a.id === id) || null;
    } catch (e) {
      throw new Error('Database query attachment failed.', { cause: error });
    }
  }
}

// Fetch all tasks for dashboard statistics
export async function getAllTasksForStats() {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      return local.tasks;
    }
    return await db.select().from(tasks);
  } catch (error) {
    console.error('Error in getAllTasksForStats:', error);
    try {
      const local = readLocalDb();
      return local.tasks;
    } catch (e) {
      throw new Error('Database statistics query failed.', { cause: error });
    }
  }
}

// Fetch all history for stats calculations
export async function getAllHistory() {
  try {
    if ((await isDbAvailable()) === false) {
      const local = readLocalDb();
      return local.history;
    }
    return await db.select().from(history);
  } catch (error) {
    console.error('Error in getAllHistory:', error);
    try {
      const local = readLocalDb();
      return local.history;
    } catch (e) {
      throw new Error('Database history query failed.', { cause: error });
    }
  }
}
