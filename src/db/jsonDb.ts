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
        name: 'ARCO-ÍRIS',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@arcoiris.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        name: 'ARTUR NOG.',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@arturnog.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 3,
        name: 'BASTOS',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@bastos.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 4,
        name: 'CATANDUVA',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@catanduva.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 5,
        name: 'CÂNDIDO M',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@candidom.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 6,
        name: 'CANDIDO R.',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@candidor.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 7,
        name: 'CRUZÁLIA',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@cruzalia.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 8,
        name: 'HERCULAN.',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@herculan.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 9,
        name: 'JABOTIC.',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@jabotic.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 10,
        name: 'LUIZIANIA',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@luiziania.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 11,
        name: 'PIRASSUN.',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@pirassun.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 12,
        name: 'POMPÉIA',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@pompeia.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 13,
        name: 'QUEIROZ',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@queiroz.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 14,
        name: 'QUINTANA',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@quintana.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 15,
        name: 'RINCÃO',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@rincao.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 16,
        name: 'SERRANA',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@serrana.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 17,
        name: 'TUPÃ',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@tupa.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 18,
        name: 'S.J.DUAS PONTES',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@sjduaspontes.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      },
      {
        id: 19,
        name: 'TAGUAÍ',
        state: 'SP',
        responsible: 'Não Definido',
        phone: '(11) 99999-9999',
        email: 'contato@taguai.sp.gov.br',
        observations: 'Importado via solicitação',
        createdAt: new Date().toISOString(),
      }
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
