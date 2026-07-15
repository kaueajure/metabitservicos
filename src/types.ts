export interface User {
  id: number;
  uid: string;
  email: string;
  name?: string | null;
  createdAt: string;
}

export interface Municipality {
  id: number;
  name: string;
  state: string;
  responsible: string;
  phone: string;
  email: string;
  observations?: string | null;
  createdAt: string;
}

export type StatusType = 'Falta XML' | 'Não iniciado' | 'Pendência Cliente' | 'Trabalhando' | 'Retificar' | 'Enviado' | 'Homologado';

export type SIOPSMembrosType = 'Não Solicitado' | 'Solicitado' | 'Recebido' | 'Importado' | 'Críticas' | 'Diferença Folha' | 'Sem críticas';

export type SIOPEFolhaType = 'Não Solicitado' | 'Solicitado' | 'Recebido' | 'Importado' | 'Críticas' | 'Diferença Folha' | 'Sem críticas';

export interface Task {
  id: number;
  municipalityId: number;
  obligationCode: string; // 'MSC', 'RREO', 'RGF', 'DCA', 'SIOPE', 'SIOPS'
  competence: string;
  year: number;
  status: StatusType;
  siopsMembros?: SIOPSMembrosType | null;
  siopeFolha?: SIOPEFolhaType | null;
  updatedAt: string;
}

export interface HistoryRecord {
  id: number;
  taskId: number;
  fieldChanged: 'status' | 'siopsMembros' | 'siopeFolha';
  oldValue: string | null;
  newValue: string | null;
  userWhoChanged: string | null;
  observation: string | null;
  createdAt: string;
}

export interface Comment {
  id: number;
  taskId: number;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface Attachment {
  id: number;
  taskId: number;
  commentId?: number | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string; // Base64
  uploadedAt: string;
}

// Predefined obligations and competencies mapping
export const OBLIGATIONS = [
  { code: 'MSC', name: 'Matriz de Saldos Contábeis (MSC)' },
  { code: 'RREO', name: 'RREO' },
  { code: 'RGF', name: 'RGF' },
  { code: 'DCA', name: 'DCA' },
  { code: 'SIOPE', name: 'SIOPE' },
  { code: 'SIOPS', name: 'SIOPS' },
] as const;

export const COMPETENCES: Record<string, string[]> = {
  MSC: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    'Encerramento'
  ],
  RREO: [
    '1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'
  ],
  RGF: [
    '1º Quadrimestre', '2º Quadrimestre', '3º Quadrimestre'
  ],
  DCA: [
    'Anual'
  ],
  SIOPE: [
    '1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'
  ],
  SIOPS: [
    '1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre', '5º Bimestre', '6º Bimestre'
  ],
};

export const STATUS_COLORS: Record<StatusType, string> = {
  'Falta XML': '#991B1B', // --red-text
  'Não iniciado': '#374151', // --gray-text
  'Pendência Cliente': '#B45309', // --amber-text
  'Trabalhando': '#1E40AF', // --blue-text
  'Retificar': '#9A3412', // --orange-text
  'Enviado': '#6B21A8', // --purple-text
  'Homologado': '#065F46', // --green-text
};

export const STATUS_BG_COLORS: Record<StatusType, string> = {
  'Falta XML': '#FEE2E2', // --red
  'Não iniciado': '#F3F4F6', // --gray
  'Pendência Cliente': '#FEF3C7', // --amber
  'Trabalhando': '#DBEAFE', // --blue
  'Retificar': '#FFEDD5', // --orange
  'Enviado': '#F3E8FF', // --purple
  'Homologado': '#D1FAE5', // --green
};

export function getDueDate(obligationCode: string, competence: string, year: number): Date {
  let endMonth = 1; // 1-indexed (Jan = 1, Feb = 2, etc.)
  const cleanComp = competence ? competence.trim() : '';

  if (obligationCode === 'MSC') {
    switch (cleanComp) {
      case 'Janeiro': endMonth = 1; break;
      case 'Fevereiro': endMonth = 2; break;
      case 'Março': endMonth = 3; break;
      case 'Abril': endMonth = 4; break;
      case 'Maio': endMonth = 5; break;
      case 'Junho': endMonth = 6; break;
      case 'Julho': endMonth = 7; break;
      case 'Agosto': endMonth = 8; break;
      case 'Setembro': endMonth = 9; break;
      case 'Outubro': endMonth = 10; break;
      case 'Novembro': endMonth = 11; break;
      case 'Dezembro': 
      case 'Encerramento': endMonth = 12; break;
      default: endMonth = 12;
    }
  } else if (obligationCode === 'RREO' || obligationCode === 'SIOPE' || obligationCode === 'SIOPS') {
    switch (cleanComp) {
      case '1º Bimestre': endMonth = 2; break;
      case '2º Bimestre': endMonth = 4; break;
      case '3º Bimestre': endMonth = 6; break;
      case '4º Bimestre': endMonth = 8; break;
      case '5º Bimestre': endMonth = 10; break;
      case '6º Bimestre': endMonth = 12; break;
      default: endMonth = 12;
    }
  } else if (obligationCode === 'RGF') {
    switch (cleanComp) {
      case '1º Quadrimestre': endMonth = 4; break;
      case '2º Quadrimestre': endMonth = 8; break;
      case '3º Quadrimestre': endMonth = 12; break;
      default: endMonth = 12;
    }
  } else if (obligationCode === 'DCA') {
    endMonth = 12;
  }
  
  let dueYear = year;
  let dueMonth = endMonth + 1; // Subsequent month (e.g. if Jan = 1, due is Feb = 2)
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear = year + 1;
  }
  
  // Create last day of that dueMonth (day 0 of the following month)
  return new Date(dueYear, dueMonth, 0, 23, 59, 59);
}

export function isTaskOverdue(status: string, obligationCode: string, competence: string, year: number, nowOverride?: Date): boolean {
  if (status === 'Homologado' || status === 'Enviado') {
    return false;
  }
  const dueDate = getDueDate(obligationCode, competence, year);
  const now = nowOverride || new Date();
  return now.getTime() > dueDate.getTime();
}

export function parseResponsible(responsibleStr: string): Record<string, any> {
  const result: Record<string, any> = {
    MSC: '',
    RREO: '',
    RGF: '',
    DCA: '',
    SIOPE: '',
    SIOPS: '',
    _activeServices: {
      MSC: true,
      RREO: true,
      RGF: true,
      DCA: true,
      SIOPE: true,
      SIOPS: true,
    }
  };

  const codes = ['MSC', 'RREO', 'RGF', 'DCA', 'SIOPE', 'SIOPS'];

  if (!responsibleStr || responsibleStr === '-' || responsibleStr.trim() === '') {
    return result;
  }

  const trimmed = responsibleStr.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        codes.forEach(code => {
          let val = parsed[code];
          if (typeof val === 'string') {
            const tv = val.trim();
            if (tv === 'true' || tv === 'false' || tv === '[object Object]' || tv.startsWith('{')) {
              result[code] = '';
            } else {
              result[code] = tv;
            }
          } else if (val !== null && val !== undefined && typeof val !== 'object') {
            result[code] = String(val);
          } else {
            result[code] = '';
          }
        });

        if (parsed._activeServices && typeof parsed._activeServices === 'object') {
          codes.forEach(code => {
            if (parsed._activeServices[code] !== undefined) {
              result._activeServices[code] = Boolean(parsed._activeServices[code]);
            }
          });
        }
        return result;
      }
    } catch (e) {
      // not valid json, treat as plain string
    }
  }

  const plainVal = responsibleStr === '-' ? '' : responsibleStr;
  codes.forEach(code => {
    result[code] = plainVal;
  });
  return result;
}

