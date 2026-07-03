import { eq, and, sql } from 'drizzle-orm';
import { db } from './index.ts';
import { users, municipalities, tasks, history, comments, attachments } from './schema.ts';
import { COMPETENCES } from '../types.ts';

// User helper
export async function getOrCreateUser(uid: string, email: string, name?: string) {
  try {
    const isMetabit = email.trim().toLowerCase() === 'comercialmetabit@gmail.com';
    const defaultEmployee = isMetabit ? 'Administrador' : null;

    const result = await db.insert(users)
      .values({
        uid,
        email,
        name: name || null,
        employeeName: defaultEmployee,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: sql`excluded.email`,
          name: sql`excluded.name`,
          employeeName: isMetabit 
            ? 'Administrador' 
            : sql`COALESCE(users.employee_name, excluded.employee_name)`
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw new Error('Database operation failed.', { cause: error });
  }
}

export async function updateUserEmployee(uid: string, employeeName: string | null) {
  try {
    const result = await db.update(users)
      .set({ employeeName })
      .where(eq(users.uid, uid))
      .returning();
    return result[0];
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
      })
      .returning();
    return result[0];
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
    const result = await db.update(municipalities)
      .set({
        name: data.name,
        state: data.state,
        responsible: data.responsible,
        phone: data.phone,
        email: data.email,
        observations: data.observations || null,
      })
      .where(eq(municipalities.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error in updateMunicipality:', error);
    throw new Error('Database update failed.', { cause: error });
  }
}

export async function deleteMunicipality(id: number) {
  try {
    const result = await db.delete(municipalities)
      .where(eq(municipalities.id, id))
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error in deleteMunicipality:', error);
    throw new Error('Database delete failed.', { cause: error });
  }
}

// Lazy tasks generator and fetcher
export async function getOrCreateTasks(year: number, obligationCode: string) {
  try {
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
            const inserted = await tx.insert(tasks)
              .values({
                municipalityId: current.municipalityId,
                obligationCode: obl,
                competence: current.competence,
                year: current.year,
                status: 'Não iniciado',
                siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                updatedAt: new Date(),
              })
              .returning();

            if (inserted.length > 0) {
              historyInserts.push({
                taskId: inserted[0].id,
                fieldChanged: 'status',
                oldValue: 'Falta XML',
                newValue: 'Não iniciado',
                userWhoChanged: data.userWhoChanged || null,
                observation: data.observation || null,
              });
            }
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
              const inserted = await tx.insert(tasks)
                .values({
                  municipalityId: current.municipalityId,
                  obligationCode: obl,
                  competence: targetBimestre,
                  year: current.year,
                  status: 'Não iniciado',
                  siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                  siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                  updatedAt: new Date(),
                })
                .returning();

              if (inserted.length > 0) {
                historyInserts.push({
                  taskId: inserted[0].id,
                  fieldChanged: 'status',
                  oldValue: 'Falta XML',
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                });
              }
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
              const inserted = await tx.insert(tasks)
                .values({
                  municipalityId: current.municipalityId,
                  obligationCode: obl,
                  competence: targetQuadrimestre,
                  year: current.year,
                  status: 'Não iniciado',
                  siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                  siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                  updatedAt: new Date(),
                })
                .returning();

              if (inserted.length > 0) {
                historyInserts.push({
                  taskId: inserted[0].id,
                  fieldChanged: 'status',
                  oldValue: 'Falta XML',
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                });
              }
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
              const inserted = await tx.insert(tasks)
                .values({
                  municipalityId: current.municipalityId,
                  obligationCode: obl,
                  competence: targetAnual,
                  year: current.year,
                  status: 'Não iniciado',
                  siopsMembros: obl === 'SIOPS' ? 'Não Solicitado' : null,
                  siopeFolha: obl === 'SIOPE' ? 'Não Solicitado' : null,
                  updatedAt: new Date(),
                })
                .returning();

              if (inserted.length > 0) {
                historyInserts.push({
                  taskId: inserted[0].id,
                  fieldChanged: 'status',
                  oldValue: 'Falta XML',
                  newValue: 'Não iniciado',
                  userWhoChanged: data.userWhoChanged || null,
                  observation: data.observation || null,
                });
              }
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

    const result = await db.update(history)
      .set({
        oldValue: data.oldValue,
        newValue: data.newValue,
        userWhoChanged: data.userWhoChanged,
        observation: data.observation,
      })
      .where(eq(history.id, id))
      .returning();

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

    return result[0];
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
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Error in addTaskComment:', error);
    throw new Error('Database insert comment failed.', { cause: error });
  }
}

// Attachments helpers
export async function getTaskAttachments(taskId: number) {
  try {
    // Select everything except fileData to avoid heavy transfer during simple list queries
    // Actually, we can retrieve them all or just retrieve name, size, type first
    // For simplicity, let's select all columns. Small files fit fine.
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
      })
      .returning();
    return result[0];
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

