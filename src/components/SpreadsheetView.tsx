import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../lib/api.ts';
import {
  Loader2,
  Search,
  Filter,
  Download,
  CheckCircle2,
  FileText,
  MessageSquare,
  Paperclip,
  Clock,
  RotateCcw,
  X,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import {
  Task,
  Municipality,
  OBLIGATIONS,
  COMPETENCES,
  STATUS_COLORS,
  STATUS_BG_COLORS,
  StatusType,
  SIOPSMembrosType,
  SIOPEFolhaType,
  getDueDate,
  isTaskOverdue
} from '../types.ts';
import { CellEditModal } from './CellEditModal.tsx';

const parseResponsible = (responsibleStr: string): Record<string, any> => {
  try {
    if (responsibleStr && responsibleStr.startsWith('{')) {
      const parsed = JSON.parse(responsibleStr);
      if (!parsed._activeServices) {
        parsed._activeServices = {
          MSC: true,
          RREO: true,
          RGF: true,
          DCA: true,
          SIOPE: true,
          SIOPS: true,
        };
      }
      return parsed;
    }
  } catch (e) {
    // Ignore
  }
  const val = responsibleStr === '-' ? '' : (responsibleStr || '');
  return {
    MSC: val,
    RREO: val,
    RGF: val,
    DCA: val,
    SIOPE: val,
    SIOPS: val,
    _activeServices: {
      MSC: true,
      RREO: true,
      RGF: true,
      DCA: true,
      SIOPE: true,
      SIOPS: true,
    }
  };
};

interface SpreadsheetViewProps {
  token: string | null;
  refreshTrigger: number;
}

export const SpreadsheetView: React.FC<SpreadsheetViewProps> = ({ token, refreshTrigger }) => {
  const [loading, setLoading] = useState(true);
  const [muns, setMuns] = useState<Municipality[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  // Configuration States
  const [selectedObligation, setSelectedObligation] = useState<string>('MSC');
  const [selectedYear, setSelectedYear] = useState<number>(2026);

  // Search and Filters States
  const [searchText, setSearchText] = useState('');

  // Excel-like Multiselect Filters
  const [filterStatus, setFilterStatus] = useState<StatusType[]>([]);
  const [filterMembros, setFilterMembros] = useState<SIOPSMembrosType[]>([]);
  const [filterFolha, setFilterFolha] = useState<SIOPEFolhaType[]>([]);
  const [filterMuns, setFilterMuns] = useState<number[]>([]);
  const [filterCompetence, setFilterCompetence] = useState<string[]>([]);

  // Active Dropdowns for Filters
  const [activeFilterDropdown, setActiveFilterDropdown] = useState<string | null>(null);

  // Edit Modal State
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveFilterDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch municipalities
      const munsRes = await apiFetch('/api/municipalities');
      const munsData = await munsRes.json();
      setMuns(munsData);

      // 2. Fetch or populate tasks
      const tasksRes = await apiFetch(`/api/tasks?year=${selectedYear}&obligationCode=${selectedObligation}`);
      const tasksData = await tasksRes.json();
      setTasks(tasksData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, selectedObligation, selectedYear, refreshTrigger]);

  const toggleStatusFilter = (stat: StatusType) => {
    setFilterStatus((prev) =>
      prev.includes(stat) ? prev.filter((s) => s !== stat) : [...prev, stat]
    );
  };

  const toggleMembrosFilter = (opt: SIOPSMembrosType) => {
    setFilterMembros((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const toggleFolhaFilter = (opt: SIOPEFolhaType) => {
    setFilterFolha((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const toggleMunFilter = (id: number) => {
    setFilterMuns((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const toggleCompetenceFilter = (comp: string) => {
    setFilterCompetence((prev) =>
      prev.includes(comp) ? prev.filter((c) => c !== comp) : [...prev, comp]
    );
  };

  const clearAllFilters = () => {
    setFilterStatus([]);
    setFilterMembros([]);
    setFilterFolha([]);
    setFilterMuns([]);
    setFilterCompetence([]);
    setSearchText('');
  };

  // Filter Logic
  const competencesList = COMPETENCES[selectedObligation] || [];

  const filteredMunsList = muns.filter((m) => {
    // Filter out if selectedObligation is inactive for this municipality
    try {
      const parsed = parseResponsible(m.responsible);
      if (parsed._activeServices && parsed._activeServices[selectedObligation] === false) {
        return false;
      }
    } catch (e) {
      // ignore
    }

    // Text search
    if (searchText) {
      const q = searchText.toLowerCase();
      const matchText =
        m.name.toLowerCase().includes(q) ||
        m.state.toLowerCase().includes(q) ||
        m.responsible.toLowerCase().includes(q);
      if (!matchText) return false;
    }

    // Municipality multi-select filter
    if (filterMuns.length > 0 && !filterMuns.includes(m.id)) {
      return false;
    }

    return true;
  });

  // Export spreadsheet engine
  const handleExportCSV = () => {
    const headers = ['Município', 'Estado', ...competencesList];
    const rows = filteredMunsList.map((m) => {
      const rowData = [m.name, m.state];
      competencesList.forEach((comp) => {
        const task = tasks.find((t) => t.municipalityId === m.id && t.competence === comp);
        let val = task ? task.status : 'Falta XML';
        if (task && selectedObligation === 'SIOPS' && task.siopsMembros) {
          val += ` (Membros: ${task.siopsMembros})`;
        } else if (task && selectedObligation === 'SIOPE' && task.siopeFolha) {
          val += ` (Folha: ${task.siopeFolha})`;
        }
        rowData.push(val);
      });
      return rowData;
    });

    const csvContent = '\uFEFF' + [headers, ...rows]
      .map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(';')) // semicolon for PT-BR Excel
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Obrigacoes_${selectedObligation}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportExcel = () => {
    // Generate clean HTML table representation which Excel opens flawlessly
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; font-family: sans-serif; }
          th { background-color: #F3F4F6; color: #111827; font-weight: bold; border: 1px solid #D1D5DB; padding: 8px; }
          td { border: 1px solid #E5E7EB; padding: 8px; }
          .status { font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Município</th>
              <th>Estado</th>
              ${competencesList.map((c) => `<th>${c}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    filteredMunsList.forEach((m) => {
      html += `<tr><td><b>${m.name}</b></td><td>${m.state}</td>`;
      competencesList.forEach((comp) => {
        const task = tasks.find((t) => t.municipalityId === m.id && t.competence === comp);
        const statusVal = task ? task.status : 'Falta XML';
        const color = STATUS_COLORS[statusVal as StatusType] || '#CBD5E1';
        let detail = '';
        if (task && selectedObligation === 'SIOPS' && task.siopsMembros) {
          detail = `<br><small style="color: #6B7280;">Membros: ${task.siopsMembros}</small>`;
        } else if (task && selectedObligation === 'SIOPE' && task.siopeFolha) {
          detail = `<br><small style="color: #6B7280;">Folha: ${task.siopeFolha}</small>`;
        }

        html += `
          <td style="background-color: ${color}10;">
            <span style="color: ${color}; font-weight: bold;">${statusVal}</span>
            ${detail}
          </td>
        `;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Obrigacoes_${selectedObligation}_${selectedYear}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleExportPDF = () => {
    // Beautiful formatted print layout trigger
    window.print();
  };

  return (
    <div className="space-y-4 animate-fade-in relative">
      {/* Configuration Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 p-3 px-4 bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 rounded-xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] transition-colors duration-300">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
              Obrigação
            </label>
            <select
              value={selectedObligation}
              onChange={(e) => {
                setSelectedObligation(e.target.value);
                clearAllFilters();
              }}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              {OBLIGATIONS.map((ob) => (
                <option key={ob.code} value={ob.code}>{ob.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1">
              Exercício / Ano
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2027">2027</option>
            </select>
          </div>
        </div>

        {/* Quick Search & Export */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Pesquisar município..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Export tools */}
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 p-1 rounded-lg border border-gray-100 dark:border-gray-700">
            <button
              onClick={handleExportExcel}
              className="px-2.5 py-1 text-xs hover:bg-white dark:hover:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300 rounded-md cursor-pointer transition-colors inline-flex items-center gap-1"
            >
              <Download size={12} /> Excel
            </button>
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1 text-xs hover:bg-white dark:hover:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300 rounded-md cursor-pointer transition-colors inline-flex items-center gap-1"
            >
              <Download size={12} /> CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="px-2.5 py-1 text-xs hover:bg-white dark:hover:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300 rounded-md cursor-pointer transition-colors inline-flex items-center gap-1"
            >
              <Download size={12} /> PDF/Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Excel Style Filtering bar */}
      <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
        <div className="text-xs text-gray-400 dark:text-gray-500 font-semibold inline-flex items-center gap-1 mr-2">
          <SlidersHorizontal size={12} /> Filtros:
        </div>

        {/* Municipality multi-select filter */}
        <div className="relative">
          <button
            onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'mun' ? null : 'mun')}
            className={`px-3 py-1 text-xs bg-white dark:bg-gray-800 border rounded-full inline-flex items-center gap-1.5 font-semibold cursor-pointer select-none ${
              filterMuns.length > 0 ? 'border-blue-500 text-blue-600 bg-blue-50/15' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Municípios ({filterMuns.length}) <ChevronDown size={12} />
          </button>
          {activeFilterDropdown === 'mun' && (
            <div className="absolute left-0 mt-1 z-30 w-56 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-xl p-3 space-y-2 animate-scale-in">
              <p className="text-[10px] uppercase font-bold text-gray-400">Filtrar Municípios</p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {muns.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterMuns.includes(m.id)}
                      onChange={() => toggleMunFilter(m.id)}
                      className="rounded-sm border-gray-300 text-blue-600"
                    />
                    <span>{m.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Status multi-select filter */}
        <div className="relative">
          <button
            onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'status' ? null : 'status')}
            className={`px-3 py-1 text-xs bg-white dark:bg-gray-800 border rounded-full inline-flex items-center gap-1.5 font-semibold cursor-pointer select-none ${
              filterStatus.length > 0 ? 'border-blue-500 text-blue-600 bg-blue-50/15' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Status ({filterStatus.length}) <ChevronDown size={12} />
          </button>
          {activeFilterDropdown === 'status' && (
            <div className="absolute left-0 mt-1 z-30 w-56 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-xl p-3 space-y-2 animate-scale-in">
              <p className="text-[10px] uppercase font-bold text-gray-400">Filtrar por Status</p>
              <div className="space-y-1.5">
                {((selectedObligation === 'SIOPE' || selectedObligation === 'SIOPS'
                  ? ['Falta XML', 'Não iniciado', 'Pendência Cliente', 'Trabalhando', 'Retificar', 'Enviado', 'Homologado']
                  : ['Falta XML', 'Não iniciado', 'Trabalhando', 'Retificar', 'Enviado', 'Homologado']) as StatusType[]).map((st) => (
                  <label key={st} className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterStatus.includes(st)}
                      onChange={() => toggleStatusFilter(st)}
                      className="rounded-sm border-gray-300 text-blue-600"
                    />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[st] }} />
                    <span>{st}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* SIOPS additional Members filter */}
        {selectedObligation === 'SIOPS' && (
          <div className="relative">
            <button
              onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'membros' ? null : 'membros')}
              className={`px-3 py-1 text-xs bg-white dark:bg-gray-800 border rounded-full inline-flex items-center gap-1.5 font-semibold cursor-pointer select-none ${
                filterMembros.length > 0 ? 'border-blue-500 text-blue-600 bg-blue-50/15' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              Membros SIOPS ({filterMembros.length}) <ChevronDown size={12} />
            </button>
            {activeFilterDropdown === 'membros' && (
              <div className="absolute left-0 mt-1 z-30 w-56 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-xl p-3 space-y-2 animate-scale-in">
                <p className="text-[10px] uppercase font-bold text-gray-400">Filtrar Controle Membros</p>
                <div className="space-y-1.5">
                  {(['Não Solicitado', 'Solicitado', 'Recebido', 'Importado', 'Críticas', 'Diferença Folha', 'Sem críticas'] as SIOPSMembrosType[]).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterMembros.includes(opt)}
                        onChange={() => toggleMembrosFilter(opt)}
                        className="rounded-sm border-gray-300 text-blue-600"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SIOPE additional Folha filter */}
        {selectedObligation === 'SIOPE' && (
          <div className="relative">
            <button
              onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'folha' ? null : 'folha')}
              className={`px-3 py-1 text-xs bg-white dark:bg-gray-800 border rounded-full inline-flex items-center gap-1.5 font-semibold cursor-pointer select-none ${
                filterFolha.length > 0 ? 'border-blue-500 text-blue-600 bg-blue-50/15' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              Folha SIOPE ({filterFolha.length}) <ChevronDown size={12} />
            </button>
            {activeFilterDropdown === 'folha' && (
              <div className="absolute left-0 mt-1 z-30 w-56 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-xl p-3 space-y-2 animate-scale-in">
                <p className="text-[10px] uppercase font-bold text-gray-400">Filtrar Controle Folha</p>
                <div className="space-y-1.5">
                  {(['Não Solicitado', 'Solicitado', 'Recebido', 'Importado', 'Críticas', 'Diferença Folha', 'Sem críticas'] as SIOPEFolhaType[]).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filterFolha.includes(opt)}
                        onChange={() => toggleFolhaFilter(opt)}
                        className="rounded-sm border-gray-300 text-blue-600"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Competence filter */}
        <div className="relative">
          <button
            onClick={() => setActiveFilterDropdown(activeFilterDropdown === 'comp' ? null : 'comp')}
            className={`px-3 py-1 text-xs bg-white dark:bg-gray-800 border rounded-full inline-flex items-center gap-1.5 font-semibold cursor-pointer select-none ${
              filterCompetence.length > 0 ? 'border-blue-500 text-blue-600 bg-blue-50/15' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            Competências ({filterCompetence.length}) <ChevronDown size={12} />
          </button>
          {activeFilterDropdown === 'comp' && (
            <div className="absolute left-0 mt-1 z-30 w-56 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-xl rounded-xl p-3 space-y-2 animate-scale-in">
              <p className="text-[10px] uppercase font-bold text-gray-400">Filtrar Competência</p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {competencesList.map((comp) => (
                  <label key={comp} className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterCompetence.includes(comp)}
                      onChange={() => toggleCompetenceFilter(comp)}
                      className="rounded-sm border-gray-300 text-blue-600"
                    />
                    <span>{comp}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clear Filters Button */}
        {(filterStatus.length > 0 || filterMembros.length > 0 || filterFolha.length > 0 || filterMuns.length > 0 || filterCompetence.length > 0 || searchText) && (
          <button
            onClick={clearAllFilters}
            className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-full inline-flex items-center gap-1 font-bold cursor-pointer"
          >
            <RotateCcw size={12} /> Limpar Filtros
          </button>
        )}
      </div>

      {/* Spreadsheet Main Grid Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
          <p className="text-gray-500 dark:text-gray-400 font-medium">Buscando e populando planilha do Excel...</p>
        </div>
      ) : muns.length === 0 ? (
        <div className="p-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center space-y-3">
          <p className="text-gray-500 dark:text-gray-400 font-medium text-sm">
            Nenhum município cadastrado. Cadastre um município na aba correspondente para gerar a planilha.
          </p>
        </div>
      ) : (
        <div className="border border-slate-200/50 dark:border-gray-800 rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)] bg-white dark:bg-gray-900 transition-colors duration-300">
          <div className="overflow-auto max-h-[600px] relative">
            <table className="w-full border-collapse text-left select-none text-xs">
              <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-gray-850">
                <tr>
                  {/* Municipalities Fixed Header */}
                  <th className={`sticky left-0 top-0 z-30 bg-gray-100 dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700 px-4 py-3 text-gray-900 dark:text-white font-bold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${
                    selectedObligation === 'MSC' ? 'min-w-[130px] max-w-[130px]' : 'min-w-[200px]'
                  }`}>
                    Município
                  </th>
                  <th className={`sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 px-2 py-3 text-center text-gray-700 dark:text-gray-300 font-bold ${
                    selectedObligation === 'MSC' ? 'min-w-[40px] max-w-[40px]' : 'min-w-[60px]'
                  }`}>
                    UF
                  </th>
                  {/* Competencies Headers */}
                  {competencesList
                    .filter((c) => filterCompetence.length === 0 || filterCompetence.includes(c))
                    .map((comp) => (
                      <th
                        key={comp}
                        className={`sticky top-0 bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 px-2 py-2.5 text-center text-gray-700 dark:text-gray-300 font-bold ${
                          selectedObligation === 'MSC' ? 'min-w-[70px] max-w-[70px] text-[10px]' : 'min-w-[150px] text-xs'
                        }`}
                      >
                        {comp}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredMunsList.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 group transition-colors">
                    {/* Fixed Municipality cell during horizontal scrolling */}
                    <td className={`sticky left-0 z-10 bg-white dark:bg-gray-800 group-hover:bg-gray-50/90 dark:group-hover:bg-gray-700 border-r border-gray-200 dark:border-gray-700 px-3 py-2.5 font-bold text-gray-900 dark:text-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${
                      selectedObligation === 'MSC' ? 'min-w-[130px] max-w-[130px]' : 'min-w-[200px]'
                    }`}>
                      <div className="truncate text-xs" title={m.name}>
                        {m.name}
                      </div>
                      {(() => {
                        const respMap = parseResponsible(m.responsible);
                        const assigned = respMap[selectedObligation];
                        if (assigned && assigned !== '-' && assigned !== '') {
                          return (
                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium block mt-0.5 truncate" title={`Responsável: ${assigned}`}>
                              {assigned}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </td>

                    {/* State column */}
                    <td className={`border-r border-gray-200 dark:border-gray-700 px-2 py-2.5 text-center text-gray-500 font-bold dark:text-gray-400 ${
                      selectedObligation === 'MSC' ? 'min-w-[40px] max-w-[40px] text-[11px]' : ''
                    }`}>
                      {m.state}
                    </td>

                    {/* Competences Cells */}
                    {competencesList
                      .filter((c) => filterCompetence.length === 0 || filterCompetence.includes(c))
                      .map((comp) => {
                        const task = tasks.find((t) => t.municipalityId === m.id && t.competence === comp);

                        // If no task found, don't crash, render placeholder cell
                        if (!task) {
                          return (
                            <td
                              key={comp}
                              className="border-r border-b border-gray-100 dark:border-gray-700 p-2 text-center text-gray-400 italic"
                            >
                              Carregando...
                            </td>
                          );
                        }

                        // Apply filters on task status, membros, and folha
                        const matchStatus = filterStatus.length === 0 || filterStatus.includes(task.status);
                        const matchMembros =
                          selectedObligation !== 'SIOPS' ||
                          filterMembros.length === 0 ||
                          filterMembros.includes((task.siopsMembros as SIOPSMembrosType));
                        const matchFolha =
                          selectedObligation !== 'SIOPE' ||
                          filterFolha.length === 0 ||
                          filterFolha.includes((task.siopeFolha as SIOPEFolhaType));

                        if (!matchStatus || !matchMembros || !matchFolha) {
                          return (
                            <td
                              key={comp}
                              className="border-r border-b border-gray-100 dark:border-gray-700 p-2 text-center text-gray-300 dark:text-gray-600 bg-gray-50/30 dark:bg-gray-900/10 italic"
                            >
                              Oculto por filtro
                            </td>
                          );
                        }

                        const isOverdue = isTaskOverdue(task.status, task.obligationCode, task.competence, task.year);
                        const dueDate = getDueDate(task.obligationCode, task.competence, task.year);
                        const formattedDueDate = dueDate.toLocaleDateString('pt-BR');
                        const statusColor = STATUS_COLORS[task.status] || '#374151';
                        const statusBg = STATUS_BG_COLORS[task.status] || '#F3F4F6';

                        return (
                          <td
                            key={comp}
                            onClick={() => setSelectedTaskForEdit(task)}
                            className={`border-r border-b border-gray-200 dark:border-gray-700/60 align-middle cursor-pointer hover:scale-[1.01] transition-transform duration-100 relative group/cell ${
                              isOverdue ? 'ring-1 ring-red-500 ring-inset bg-red-50/10 dark:bg-red-950/5' : ''
                            } ${
                              selectedObligation === 'MSC' ? 'p-1 min-h-[38px] min-w-[70px] max-w-[70px]' : 'p-1.5 min-h-[50px] min-w-[150px]'
                            }`}
                            title={`Status: ${task.status}\nVencimento: ${formattedDueDate}${isOverdue ? ' (VENCIDO!)' : ''}\nClique para editar, adicionar observações, histórico ou arquivos.`}
                          >
                            <div
                              className={`w-full h-full rounded border flex flex-col justify-center text-center ${
                                selectedObligation === 'MSC' ? 'p-1 min-h-[28px]' : 'p-2'
                              }`}
                              style={{
                                backgroundColor: statusBg,
                                borderColor: isOverdue ? '#EF4444' : 'transparent',
                                color: statusColor,
                              }}
                            >
                              <div className="flex items-center justify-center">
                                <span className={`font-bold tracking-wider uppercase truncate ${
                                  selectedObligation === 'MSC' ? 'text-[8px]' : 'text-[9px]'
                                }`}>
                                  {selectedObligation === 'MSC' ? (
                                    task.status === 'Não iniciado' ? 'Não Inic.' :
                                    task.status === 'Trabalhando' ? 'Trab.' :
                                    task.status === 'Retificar' ? 'Retif.' :
                                    task.status === 'Homologado' ? 'Homolog.' :
                                    task.status === 'Falta XML' ? 'F. XML' :
                                    task.status
                                  ) : (
                                    task.status
                                  )}
                                </span>
                              </div>

                              {/* SIOPS additional label */}
                              {selectedObligation === 'SIOPS' && task.siopsMembros && (
                                <span className="text-[9px] mt-1 text-gray-500/80 dark:text-gray-400 font-semibold border-t border-gray-200/40 dark:border-gray-700/40 pt-0.5 truncate">
                                  {task.siopsMembros}
                                </span>
                              )}

                              {/* SIOPE additional label */}
                              {selectedObligation === 'SIOPE' && task.siopeFolha && (
                                <span className="text-[9px] mt-1 text-gray-500/80 dark:text-gray-400 font-semibold border-t border-gray-200/40 dark:border-gray-700/40 pt-0.5 truncate">
                                  {task.siopeFolha}
                                </span>
                              )}

                              {/* Display deadline inside non-MSC cells */}
                              {selectedObligation !== 'MSC' && (
                                <span className={`text-[8.5px] mt-1.5 px-1 py-0.5 rounded-sm self-center font-bold border ${
                                  isOverdue 
                                    ? 'text-red-700 dark:text-red-400 bg-red-100/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' 
                                    : (task.status === 'Homologado' || task.status === 'Enviado')
                                      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-150/30'
                                      : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 border-gray-200/30'
                                }`}>
                                  {isOverdue ? `Vencido ${formattedDueDate}` : `Prazo: ${formattedDueDate}`}
                                </span>
                              )}
                            </div>

                            {/* Indicators of Comments, Attachments or Logs */}
                            <div className="absolute right-1 top-1 flex items-center gap-0.5 transition-opacity">
                              {isOverdue && (
                                <span 
                                  className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse border border-white dark:border-gray-900" 
                                  title={`Atenção: Prazo de entrega vencido em ${formattedDueDate}!`}
                                />
                              )}
                            </div>
                          </td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Popover Dialog */}
      {selectedTaskForEdit && (
        <CellEditModal
          task={selectedTaskForEdit}
          municipalityName={muns.find((m) => m.id === selectedTaskForEdit.municipalityId)?.name || 'Município'}
          token={token}
          onClose={() => setSelectedTaskForEdit(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};
export default SpreadsheetView;
