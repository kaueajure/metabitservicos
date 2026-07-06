import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_FILE = path.join(process.cwd(), 'fallback_db.json');

export interface LocalDbData {
  users: any[];
  municipalities: any[];
  tasks: any[];
  history: any[];
  comments: any[];
  attachments: any[];
}

function getInitialData(): LocalDbData {
  const hashedAdminPassword = bcrypt.hashSync('admin', 10);
  return {
    users: [
      {
        id: 1,
        uid: 'admin_uid_metabit_2026',
        email: 'comercialmetabit@gmail.com',
        password: hashedAdminPassword,
        name: 'Administrador Metabit',
        employeeName: 'Administrador',
        createdAt: new Date().toISOString(),
      },
    ],
    municipalities: [
      {
        id: 1,
        name: 'Goiânia',
        state: 'GO',
        responsible: 'Keila',
        phone: '(62) 99999-9999',
        email: 'goiania@municipio.go.gov.br',
        observations: 'Município Polo da Região',
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        name: 'Aparecida de Goiânia',
        state: 'GO',
        responsible: 'Simão',
        phone: '(62) 88888-8888',
        email: 'aparecida@municipio.go.gov.br',
        observations: 'Atendimento prioritário',
        createdAt: new Date().toISOString(),
      },
      {
        id: 3,
        name: 'Anápolis',
        state: 'GO',
        responsible: 'Mirian',
        phone: '(62) 77777-7777',
        email: 'anapolis@municipio.go.gov.br',
        observations: 'Polo Industrial e Logístico',
        createdAt: new Date().toISOString(),
      },
      {
        id: 4,
        name: 'Rio Verde',
        state: 'GO',
        responsible: 'Richelly',
        phone: '(64) 96666-6666',
        email: 'rioverde@municipio.go.gov.br',
        observations: 'Destaque no Agronegócio',
        createdAt: new Date().toISOString(),
      },
      {
        id: 5,
        name: 'Luziânia',
        state: 'GO',
        responsible: 'Gabriel',
        phone: '(61) 95555-5555',
        email: 'luziania@municipio.go.gov.br',
        observations: 'Região do Entorno do DF',
        createdAt: new Date().toISOString(),
      },
    ],
    tasks: [],
    history: [],
    comments: [],
    attachments: [],
  };
}

export function readLocalDb(): LocalDbData {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialData();
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading local fallback DB file:', err);
    return getInitialData();
  }
}

export function writeLocalDb(data: LocalDbData) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local fallback DB file:', err);
  }
}
