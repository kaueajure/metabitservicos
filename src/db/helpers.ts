import { eq, and, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { users, municipalities, tasks, history, comments, attachments } from './schema.ts';
import { COMPETENCES } from '../types.ts';
import bcrypt from 'bcryptjs';

export async function isDbAvailable(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    console.log('✅ Connected to MySQL database successfully.');
    return true;
  } catch (err: any) {
    console.error('❌ CRITICAL: MySQL database connection failed:', err.message);
    throw new Error(`MySQL database connection is required but failed: ${err.message}`);
  }
}

// Custom Auth Helpers
export async function getUserByEmail(email: string) {
  try {
    const result = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error in getUserByEmail:', error);
    throw error;
  }
}

export async function getUserByUid(uid: string) {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Error in getUserByUid:', error);
    throw error;
  }
}

export async function createUser(data: {
  email: string;
  passwordPlain: string;
  name?: string;
  employeeName?: string;
}) {
  try {
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
    throw error;
  }
}

export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const isMetabit = email.trim().toLowerCase() === 'comercialmetabit@gmail.com';
    const defaultEmployee = isMetabit ? 'Administrador' : null;

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
    throw new Error('Database operation failed.', { cause: error });
  }
}

export async function updateUserEmployee(uid: string, employeeName: string | null) {
  try {
    await db.update(users)
      .set({ employeeName })
      .where(eq(users.uid, uid));
    const updated = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return updated[0];
  } catch (error) {
    console.error('Error in updateUserEmployee:', error);
    throw new Error('Database operation failed.', { cause: error });
  }
}

// Municipalities helpers
export async function getMunicipalities() {
  try {
    return await db.select().from(municipalities).orderBy(municipalities.name);
  } catch (error) {
    console.error('Error in getMunicipalities:', error);
    throw new Error('Database query failed.', { cause: error });
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
    throw new Error('Database insert failed.', { cause: error });
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
    throw new Error('Database update failed.', { cause: error });
  }
}

export async function deleteMunicipality(id: number) {
  try {
    const existing = await db.select().from(municipalities).where(eq(municipalities.id, id)).limit(1);
    await db.delete(municipalities)
      .where(eq(municipalities.id, id));
    return existing[0];
  } catch (error) {
    console.error('Error in deleteMunicipality:', error);
    throw new Error('Database delete failed.', { cause: error });
  }
}

// Lazy tasks generator and fetcher
export async function getOrCreateTasks(year: number, obligationCode: string) {
  try {
    const muns = await db.select().from(municipalities);
    const competencesList = COMPETENCES[obligationCode] || [];

    if (muns.length === 0 || competencesList.length === 0) {
      return [];
    }

    const existingTasks = await db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.year, year),
          eq(tasks.obligationCode, obligationCode)
        )
      );

    const taskMap = new Map<string, typeof tasks.$inferSelect>();
    for (const t of existingTasks) {
      taskMap.set(`${t.municipalityId}_${t.competence}`, t);
    }

    const tasksToInsert: (typeof tasks.$inferInsert)[] = [];

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

    if (tasksToInsert.length > 0) {
      await db.insert(tasks).values(tasksToInsert);
    }

    const allFetched = await db.select()
      .from(tasks)
      .where(
        and(
          eq(tasks.year, year),
          eq(tasks.obligationCode, obligationCode)
        )
      );

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
    throw new Error('Database fetch/generate tasks failed.', { cause: error });
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
    return await db.transaction(async (tx) => {
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
        const compatibleObligations = Object.keys(COMPETENCES).filter(code =>
          COMPETENCES[code].includes(current.competence)
        );

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
            if (sibling.id === taskId) {
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

        const MONTH_TO_QUADRIMESTRE: Record<string, string> = {
          'Abril': '1º Quadrimestre',
          'Agosto': '2º Quadrimestre',
          'Dezembro': '3º Quadrimestre',
        };

        const targetQuadrimestre = MONTH_TO_QUADRIMESTRE[current.competence];
        if (targetQuadrimestre) {
          const targetObligations = ['RGF'];
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

        const MONTH_TO_ANUAL: Record<string, string> = {
          'Encerramento': 'Anual',
        };

        const targetAnual = MONTH_TO_ANUAL[current.competence];
        if (targetAnual) {
          const targetObligations = ['DCA'];
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

      if (Object.keys(updateData).length > 1) {
        await tx.update(tasks).set(updateData).where(eq(tasks.id, taskId));
      }

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
    return await db.select()
      .from(history)
      .where(eq(history.taskId, taskId))
      .orderBy(history.createdAt);
  } catch (error) {
    console.error('Error in getTaskHistory:', error);
    throw new Error('Database history query failed.', { cause: error });
  }
}

export async function updateHistoryEntry(id: number, data: {
  oldValue?: string | null;
  newValue?: string | null;
  userWhoChanged?: string | null;
  observation?: string | null;
}) {
  try {
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
    throw new Error('Database history update failed.', { cause: error });
  }
}

// Comments helpers
export async function getTaskComments(taskId: number) {
  try {
    return await db.select()
      .from(comments)
      .where(eq(comments.taskId, taskId))
      .orderBy(comments.createdAt);
  } catch (error) {
    console.error('Error in getTaskComments:', error);
    throw new Error('Database comments query failed.', { cause: error });
  }
}

export async function addTaskComment(taskId: number, authorName: string, text: string) {
  try {
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
    throw new Error('Database insert comment failed.', { cause: error });
  }
}

// Attachments helpers
export async function getTaskAttachments(taskId: number) {
  try {
    return await db.select()
      .from(attachments)
      .where(eq(attachments.taskId, taskId))
      .orderBy(attachments.uploadedAt);
  } catch (error) {
    console.error('Error in getTaskAttachments:', error);
    throw new Error('Database attachments query failed.', { cause: error });
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
    throw new Error('Database insert attachment failed.', { cause: error });
  }
}

export async function getAttachmentById(id: number) {
  try {
    const result = await db.select().from(attachments).where(eq(attachments.id, id));
    return result[0] || null;
  } catch (error) {
    console.error('Error in getAttachmentById:', error);
    throw new Error('Database query attachment failed.', { cause: error });
  }
}

// Fetch all tasks for dashboard statistics
export async function getAllTasksForStats() {
  try {
    return await db.select().from(tasks);
  } catch (error) {
    console.error('Error in getAllTasksForStats:', error);
    throw new Error('Database statistics query failed.', { cause: error });
  }
}

// Fetch all history for stats calculations
export async function getAllHistory() {
  try {
    return await db.select().from(history);
  } catch (error) {
    console.error('Error in getAllHistory:', error);
    throw new Error('Database history query failed.', { cause: error });
  }
}

// Employees helper functions
export async function getEmployees(): Promise<string[]> {
  try {
    const defaultList = [
      'Administrador',
      'Simão',
      'Keila',
      'Mirian',
      'Richelly',
      'Gabriel',
      'Adriano',
      'Tiago'
    ];
    const dbUsers = await db.select({ employeeName: users.employeeName }).from(users);
    const set = new Set<string>(defaultList);
    for (const u of dbUsers) {
      if (u.employeeName && u.employeeName.trim()) {
        set.add(u.employeeName.trim());
      }
    }
    return Array.from(set);
  } catch (error) {
    console.error('Error in getEmployees:', error);
    return [
      'Administrador',
      'Simão',
      'Keila',
      'Mirian',
      'Richelly',
      'Gabriel',
      'Adriano',
      'Tiago'
    ];
  }
}

export async function createEmployee(name: string): Promise<string[]> {
  try {
    const list = await getEmployees();
    const clean = name.trim();
    if (clean && !list.includes(clean)) {
      list.push(clean);
    }
    return list;
  } catch (error) {
    console.error('Error in createEmployee:', error);
    throw new Error('Erro ao cadastrar funcionário.');
  }
}
