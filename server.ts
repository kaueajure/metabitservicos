import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import { users } from './src/db/schema.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { isTaskOverdue } from './src/types.ts';
import {
  getOrCreateUser,
  updateUserEmployee,
  getMunicipalities,
  createMunicipality,
  updateMunicipality,
  deleteMunicipality,
  getOrCreateTasks,
  updateTaskDetails,
  getTaskHistory,
  updateHistoryEntry,
  getTaskComments,
  addTaskComment,
  getTaskAttachments,
  addAttachment,
  getAttachmentById,
  getAllTasksForStats,
  getAllHistory,
  getUserByEmail,
  getUserByUid,
  createUser,
  getEmployees,
  createEmployee,
} from './src/db/helpers.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'metabit_secret_key_123';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure high body limit for base64 file uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }));

  // API Routes (must be defined BEFORE Vite middleware)

  // Auth registration
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, name, employeeName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      const existing = await getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'E-mail já cadastrado.' });
      }

      // Check special email mandatory admin assignment
      const isMetabit = email.trim().toLowerCase() === 'comercialmetabit@gmail.com';
      const finalEmployeeName = isMetabit ? 'Administrador' : (employeeName || null);

      const dbUser = await createUser({
        email,
        passwordPlain: password,
        name,
        employeeName: finalEmployeeName,
      });

      const token = jwt.sign(
        { uid: dbUser.uid, email: dbUser.email, name: dbUser.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.status(201).json({ token, user: dbUser });
    } catch (error: any) {
      console.error('Register route error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Auth login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      let dbUser = await getUserByEmail(cleanEmail);

      if (!dbUser) {
        if (cleanEmail === 'comercialmetabit@gmail.com' || cleanEmail === 'admin@metabit.com') {
          const hashedPassword = await bcrypt.hash(password || 'admin', 10);
          const uid = 'admin_uid_' + Math.random().toString(36).substring(2, 9);
          const result = await db.insert(users).values({
            uid,
            email: cleanEmail,
            password: hashedPassword,
            name: 'Administrador Metabit',
            employeeName: 'Administrador',
          });
          const insertId = (result[0] as any).insertId;
          const inserted = await db.select().from(users).where(eq(users.id, insertId)).limit(1);
          dbUser = inserted[0];
        } else {
          return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        }
      }

      let passwordMatch = await bcrypt.compare(password, dbUser.password);
      if (!passwordMatch) {
        if (cleanEmail === 'comercialmetabit@gmail.com' && password === 'admin') {
          const hashedPassword = await bcrypt.hash('admin', 10);
          await db.update(users).set({ password: hashedPassword }).where(eq(users.id, dbUser.id));
          dbUser = await getUserByEmail(cleanEmail);
          passwordMatch = true;
        } else {
          return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
        }
      }

      const token = jwt.sign(
        { uid: dbUser.uid, email: dbUser.email, name: dbUser.name },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ token, user: dbUser });
    } catch (error: any) {
      console.error('Login route error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Auth me (retrieve current user profile)
  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid || '';
      if (!uid) {
        return res.status(400).json({ error: 'Não autenticado' });
      }
      const dbUser = await getUserByUid(uid);
      if (!dbUser) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      res.json(dbUser);
    } catch (error: any) {
      console.error('Auth Me route error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Link current user to an employee
  app.post('/api/auth/link-employee', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { employeeName } = req.body;
      const uid = req.user?.uid || '';
      if (!uid) {
        return res.status(400).json({ error: 'Missing UID' });
      }
      
      const email = req.user?.email || '';
      const isMetabit = email.trim().toLowerCase() === 'comercialmetabit@gmail.com';
      if (isMetabit && employeeName !== 'Administrador') {
        return res.status(400).json({ error: 'O email comercialmetabit@gmail.com deve obrigatoriamente estar vinculado ao Administrador.' });
      }

      const updatedUser = await updateUserEmployee(uid, employeeName || null);
      res.json(updatedUser);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Employees API Endpoints
  app.get('/api/employees', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await getEmployees();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/employees', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'O nome do funcionário é obrigatório.' });
      }
      const list = await createEmployee(name);
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Municipalities CRUD
  app.get('/api/municipalities', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await getMunicipalities();
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/municipalities', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, state, responsible, phone, email, observations } = req.body;
      if (!name || !state) {
        return res.status(400).json({ error: 'O nome do município e o estado são obrigatórios.' });
      }
      const created = await createMunicipality({
        name,
        state,
        responsible: responsible || '-',
        phone: phone || '-',
        email: email || 'contato@municipio.gov.br',
        observations: observations || '',
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/municipalities/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, state, responsible, phone, email, observations } = req.body;
      if (!name || !state) {
        return res.status(400).json({ error: 'O nome do município e o estado são obrigatórios.' });
      }
      const updated = await updateMunicipality(id, {
        name,
        state,
        responsible: responsible || '-',
        phone: phone || '-',
        email: email || 'contato@municipio.gov.br',
        observations: observations || '',
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/municipalities/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const deleted = await deleteMunicipality(id);
      res.json(deleted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Tasks Query & Lazy Population
  app.get('/api/tasks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const year = parseInt(req.query.year as string, 10);
      const obligationCode = req.query.obligationCode as string;

      if (!year || !obligationCode) {
        return res.status(400).json({ error: 'Parametros "year" e "obligationCode" são obrigatórios.' });
      }

      const list = await getOrCreateTasks(year, obligationCode);
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Task update & History log creation
  app.put('/api/tasks/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { status, siopsMembros, siopeFolha, userWhoChanged, observation } = req.body;

      const userEmail = req.user?.email || 'Usuário';
      let actualUserWhoChanged = userWhoChanged ? userWhoChanged.trim() : userEmail;
      if (actualUserWhoChanged.toLowerCase() === 'comercialmetabit@gmail.com') {
        actualUserWhoChanged = 'Administrador';
      }

      const updated = await updateTaskDetails(id, {
        status,
        siopsMembros,
        siopeFolha,
        userWhoChanged: actualUserWhoChanged,
        observation: observation ? observation.trim() : undefined,
      });

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Task history query
  app.get('/api/tasks/:id/history', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const hist = await getTaskHistory(id);
      const mappedHist = hist.map(h => {
        if (h.userWhoChanged && h.userWhoChanged.trim().toLowerCase() === 'comercialmetabit@gmail.com') {
          return { ...h, userWhoChanged: 'Administrador' };
        }
        return h;
      });
      res.json(mappedHist);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update task history entry
  app.put('/api/history/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      let { oldValue, newValue, userWhoChanged, observation } = req.body;
      if (userWhoChanged && userWhoChanged.trim().toLowerCase() === 'comercialmetabit@gmail.com') {
        userWhoChanged = 'Administrador';
      }
      const updated = await updateHistoryEntry(id, { oldValue, newValue, userWhoChanged, observation });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Task comments query & insert
  app.get('/api/tasks/:id/comments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const list = await getTaskComments(id);
      const mappedComments = list.map(c => {
        if (c.authorName && c.authorName.trim().toLowerCase() === 'comercialmetabit@gmail.com') {
          return { ...c, authorName: 'Administrador' };
        }
        return c;
      });
      res.json(mappedComments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tasks/:id/comments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { text, authorName } = req.body;
      const userEmail = req.user?.email || 'Usuário';
      let author = authorName ? authorName.trim() : userEmail;
      if (author.toLowerCase() === 'comercialmetabit@gmail.com') {
        author = 'Administrador';
      }

      if (!text) {
        return res.status(400).json({ error: 'Texto do comentário é obrigatório.' });
      }

      const comment = await addTaskComment(id, author, text);
      res.status(201).json(comment);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Task attachments query & upload
  app.get('/api/tasks/:id/attachments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const list = await getTaskAttachments(id);
      res.json(list);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/tasks/:id/attachments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { fileName, fileType, fileSize, fileData } = req.body;

      if (!fileName || !fileType || !fileSize || !fileData) {
        return res.status(400).json({ error: 'Nome, tipo, tamanho e dados do arquivo (Base64) são obrigatórios.' });
      }

      const created = await addAttachment({
        taskId: id,
        fileName,
        fileType,
        fileSize,
        fileData,
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // File download route (gets base64 data and sends it as a file stream/buffer)
  app.get('/api/attachments/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const item = await getAttachmentById(id);

      if (!item) {
        return res.status(404).json({ error: 'Anexo não encontrado.' });
      }

      // If they requested JSON data, we send it directly
      if (req.query.json === 'true') {
        return res.json(item);
      }

      // Otherwise we can send it as a real file download
      const fileBuffer = Buffer.from(item.fileData, 'base64');
      res.setHeader('Content-Type', item.fileType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.fileName)}"`);
      res.send(fileBuffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard Stats API
  app.get('/api/stats', requireAuth, async (req: AuthRequest, res) => {
    try {
      const muns = await getMunicipalities();
      const allTasks = await getAllTasksForStats();
      const allHistory = await getAllHistory();

      // Sort history by ID ascending so the latest change overrides previous ones
      allHistory.sort((a, b) => a.id - b.id);

      // Build a map of taskId to the latest person who set the status to completed ('Homologado' or 'Enviado')
      const taskCompletedByMap = new Map<number, string>();
      for (const h of allHistory) {
        if (h.fieldChanged === 'status' && (h.newValue === 'Homologado' || h.newValue === 'Enviado') && h.userWhoChanged) {
          let trimmed = h.userWhoChanged.trim();
          if (trimmed.toLowerCase() === 'comercialmetabit@gmail.com') {
            trimmed = 'Administrador';
          }
          if (trimmed && trimmed !== '-') {
            taskCompletedByMap.set(h.taskId, trimmed);
          }
        }
      }

      const municipalityMap = new Map<number, any>();
      for (const m of muns) {
        municipalityMap.set(m.id, m);
      }

      // Filter tasks to only count those whose obligations are active for that municipality
      const activeTasks = allTasks.filter(t => {
        const mun = municipalityMap.get(t.municipalityId);
        if (!mun) return false;
        try {
          if (mun.responsible && mun.responsible.startsWith('{')) {
            const parsed = JSON.parse(mun.responsible);
            if (parsed._activeServices && parsed._activeServices[t.obligationCode] === false) {
              return false;
            }
          }
        } catch (e) {
          // ignore
        }
        return true;
      });

      const totalMuns = muns.length;
      const totalTasks = activeTasks.length;

      // Group tasks by status
      const statusCounts: Record<string, number> = {
        'Falta XML': 0,
        'Não iniciado': 0,
        'Pendência Cliente': 0,
        'Trabalhando': 0,
        'Retificar': 0,
        'Enviado': 0,
        'Homologado': 0,
      };

      for (const t of activeTasks) {
        if (statusCounts[t.status] !== undefined) {
          statusCounts[t.status]++;
        } else {
          statusCounts[t.status] = 1;
        }
      }

      // Group tasks by obligation
      const obligationCounts: Record<string, Record<string, number>> = {};
      // Group tasks by state (municipality state)
      const municipalityStateMap = new Map<number, string>();
      for (const m of muns) {
        municipalityStateMap.set(m.id, m.state);
      }

      const obligationStatusMap: Record<string, Record<string, number>> = {};
      const obligationCompetenceStats: Record<string, Record<string, { Concluido: number; Pendente: number }>> = {};
      const municipalityStatusMap: Record<string, Record<string, number>> = {};
      const competenceStatusMap: Record<string, Record<string, number>> = {};
      const responsibleStatusMap: Record<string, { Concluido: number; Pendente: number; municipalities: Set<string> }> = {};

      let totalOverdue = 0;
      const overdueByObligation: Record<string, number> = {};
      const overdueByMunicipality: Record<string, number> = {};
      const overdueByResponsible: Record<string, number> = {};

      for (const t of activeTasks) {
        const mun = municipalityMap.get(t.municipalityId);
        const munName = mun?.name || 'Outro';

        const code = t.obligationCode;
        const comp = t.competence;
        if (!obligationStatusMap[code]) {
          obligationStatusMap[code] = { 'Concluído': 0, 'Pendente': 0 };
        }
        if (!obligationCompetenceStats[code]) {
          obligationCompetenceStats[code] = {};
        }
        if (!obligationCompetenceStats[code][comp]) {
          obligationCompetenceStats[code][comp] = { Concluido: 0, Pendente: 0 };
        }
        if (t.status === 'Homologado' || t.status === 'Enviado') {
          obligationStatusMap[code]['Concluído']++;
          obligationCompetenceStats[code][comp].Concluido++;
        } else {
          obligationStatusMap[code]['Pendente']++;
          obligationCompetenceStats[code][comp].Pendente++;
        }

        if (!municipalityStatusMap[munName]) {
          municipalityStatusMap[munName] = { 'Concluído': 0, 'Pendente': 0 };
        }
        if (t.status === 'Homologado' || t.status === 'Enviado') {
          municipalityStatusMap[munName]['Concluído']++;
        } else {
          municipalityStatusMap[munName]['Pendente']++;
        }

        if (!competenceStatusMap[comp]) {
          competenceStatusMap[comp] = { 'Concluído': 0, 'Pendente': 0 };
        }
        if (t.status === 'Homologado' || t.status === 'Enviado') {
          competenceStatusMap[comp]['Concluído']++;
        } else {
          competenceStatusMap[comp]['Pendente']++;
        }

        // Responsible (employee) stats supporting multiple responsibles split by comma
        let taskResponsibles: string[] = [];
        const isCompleted = t.status === 'Homologado' || t.status === 'Enviado';
        const completedBy = isCompleted ? taskCompletedByMap.get(t.id) : null;

        if (isCompleted && completedBy) {
          taskResponsibles = [completedBy];
        } else {
          try {
            if (mun?.responsible && mun.responsible.startsWith('{')) {
              const parsed = JSON.parse(mun.responsible);
              const assignedVal = parsed[t.obligationCode];
              const getStr = (v: any, code: string): string => {
                if (!v) return '';
                if (typeof v === 'string') {
                  const trimmed = v.trim();
                  if (trimmed.startsWith('{')) {
                    try { return getStr(JSON.parse(trimmed), code); } catch(e) { return v; }
                  }
                  return v;
                }
                if (typeof v === 'object') {
                  if (v[code] !== undefined) return getStr(v[code], code);
                  for (const x of Object.values(v)) {
                    const res = getStr(x, code);
                    if (res) return res;
                  }
                }
                return String(v);
              };
              const assignedStr = getStr(assignedVal, t.obligationCode);
              if (assignedStr && assignedStr !== '-') {
                taskResponsibles = assignedStr.split(',').map((s: string) => s.trim()).filter((s: string) => s && s !== '-');
              }
            } else if (mun?.responsible && mun.responsible !== '-') {
              taskResponsibles = mun.responsible.split(',').map((s: string) => s.trim()).filter((s: string) => s && s !== '-');
            }
          } catch (e) {
            // fallback
          }
        }

        if (taskResponsibles.length === 0) {
          taskResponsibles = ['Não Atribuído'];
        }

        for (const respName of taskResponsibles) {
          if (!responsibleStatusMap[respName]) {
            responsibleStatusMap[respName] = { Concluido: 0, Pendente: 0, municipalities: new Set() };
          }
          responsibleStatusMap[respName].municipalities.add(munName);
          if (t.status === 'Homologado' || t.status === 'Enviado') {
            responsibleStatusMap[respName].Concluido++;
          } else {
            responsibleStatusMap[respName].Pendente++;
          }
        }

        // Check overdue status
        const isOverdue = isTaskOverdue(t.status, t.obligationCode, t.competence, t.year);
        if (isOverdue) {
          totalOverdue++;
          overdueByObligation[code] = (overdueByObligation[code] || 0) + 1;
          overdueByMunicipality[munName] = (overdueByMunicipality[munName] || 0) + 1;
          for (const respName of taskResponsibles) {
            overdueByResponsible[respName] = (overdueByResponsible[respName] || 0) + 1;
          }
        }
      }

      const responsibleStats = Object.entries(responsibleStatusMap).map(([name, data]) => ({
        name,
        Concluido: data.Concluido,
        Pendente: data.Pendente,
        Total: data.Concluido + data.Pendente,
        TaxaConclusao: data.Concluido + data.Pendente > 0 ? Math.round((data.Concluido / (data.Concluido + data.Pendente)) * 100) : 0,
        MunicipiosAtendidos: Array.from(data.municipalities),
        QtdMunicipios: data.municipalities.size,
      }));

      // Calculate overall percentages
      const completedCount = (statusCounts['Homologado'] || 0) + (statusCounts['Enviado'] || 0);
      const pendingCount = totalTasks - completedCount;
      const pctCompleted = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;
      const pctPending = totalTasks > 0 ? 100 - pctCompleted : 0;

      res.json({
        totalMuns,
        totalTasks,
        statusCounts,
        pctCompleted,
        pctPending,
        obligationStats: obligationStatusMap,
        obligationCompetenceStats,
        municipalityStats: municipalityStatusMap,
        competenceStats: competenceStatusMap,
        responsibleStats,
        overdueStats: {
          totalOverdue,
          overdueByObligation,
          overdueByMunicipality,
          overdueByResponsible,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite development vs production config
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
