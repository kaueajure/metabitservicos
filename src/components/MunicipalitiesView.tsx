import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.ts';
import { Plus, Search, Edit2, Trash2, Loader2, Mail, Phone, User, AlertCircle, X, ChevronRight, FileText, ChevronDown, Copy } from 'lucide-react';
import { Municipality, parseResponsible } from '../types.ts';
import { useAuth } from '../contexts/AuthContext.tsx';

export const EMPLOYEES = [
  'Administrador',
  'Simão',
  'Keila',
  'Mirian',
  'Richelly',
  'Gabriel',
  'Adriano',
  'Tiago'
];

export const SERVICES = [
  { code: 'MSC', name: 'MSC (Matriz de Saldos Contábeis)' },
  { code: 'RREO', name: 'RREO (Relatório Resumido de Execução Orçamentária)' },
  { code: 'RGF', name: 'RGF (Relatório de Gestão Fiscal)' },
  { code: 'DCA', name: 'DCA (Declaração de Contas Anuais)' },
  { code: 'SIOPE', name: 'SIOPE (Educação)' },
  { code: 'SIOPS', name: 'SIOPS (Saúde)' }
];

interface MunicipalitiesViewProps {
  token: string | null;
  onRefreshSpreadsheet: () => void;
}

export const MunicipalitiesView: React.FC<MunicipalitiesViewProps> = ({ token, onRefreshSpreadsheet }) => {
  const { employees, registerEmployee } = useAuth();
  const [newEmpName, setNewEmpName] = useState('');
  const [modalNewEmpName, setModalNewEmpName] = useState('');
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const handleAddEmployeeClick = async () => {
    if (!newEmpName.trim()) return;
    try {
      setEmployeeError(null);
      await registerEmployee(newEmpName.trim());
      setNewEmpName('');
    } catch (err: any) {
      setEmployeeError(err.message || 'Erro ao cadastrar funcionário.');
    }
  };

  const handleModalAddEmployee = async () => {
    if (!modalNewEmpName.trim()) return;
    try {
      setEmployeeError(null);
      await registerEmployee(modalNewEmpName.trim());
      setModalNewEmpName('');
    } catch (err: any) {
      setEmployeeError(err.message || 'Erro ao cadastrar funcionário.');
    }
  };

  const [muns, setMuns] = useState<Municipality[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [formName, setFormName] = useState('');
  const [formState, setFormState] = useState('SP');
  const [formResponsibles, setFormResponsibles] = useState<Record<string, string>>({
    MSC: '',
    RREO: '',
    RGF: '',
    DCA: '',
    SIOPE: '',
    SIOPS: '',
  });
  const [formActiveServices, setFormActiveServices] = useState<Record<string, boolean>>({
    MSC: true,
    RREO: true,
    RGF: true,
    DCA: true,
    SIOPE: true,
    SIOPS: true,
  });
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formObservations, setFormObservations] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const isEmployeeChecked = (serviceCode: string, emp: string) => {
    const currentVal = formResponsibles[serviceCode] || '';
    const selected = currentVal.split(',').map(s => s.trim()).filter(Boolean);
    return selected.includes(emp);
  };

  const handleEmployeeToggle = (serviceCode: string, emp: string) => {
    const currentVal = formResponsibles[serviceCode] || '';
    let selected = currentVal.split(',').map(s => s.trim()).filter(Boolean);
    if (selected.includes(emp)) {
      selected = selected.filter(name => name !== emp);
    } else {
      selected = [...selected, emp];
    }
    setFormResponsibles({
      ...formResponsibles,
      [serviceCode]: selected.join(', '),
    });
  };

  const getSelectedLabel = (serviceCode: string) => {
    const currentVal = formResponsibles[serviceCode] || '';
    const selected = currentVal.split(',').map(s => s.trim()).filter(Boolean);
    if (selected.length === 0) return '- Sem Responsável -';
    return selected.join(', ');
  };

  // Custom Confirmation / Alert States to bypass browser iframe restrictions
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchMunicipalities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/municipalities');
      if (!res.ok) throw new Error('Não foi possível obter a lista de municípios.');
      const data = await res.json();
      setMuns(data);
    } catch (err: any) {
      console.error(err);
      setError('Erro de conexão ao carregar municípios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMunicipalities();
    }
  }, [token]);

  const openAddModal = () => {
    setEditingId(null);
    setIsCloning(false);
    setFormName('');
    setFormState('SP');
    setFormResponsibles({
      MSC: '',
      RREO: '',
      RGF: '',
      DCA: '',
      SIOPE: '',
      SIOPS: '',
    });
    setFormActiveServices({
      MSC: true,
      RREO: true,
      RGF: true,
      DCA: true,
      SIOPE: true,
      SIOPS: true,
    });
    setFormPhone('');
    setFormEmail('');
    setFormObservations('');
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (m: Municipality) => {
    setEditingId(m.id);
    setIsCloning(false);
    setFormName(m.name);
    setFormState(m.state);
    
    const parsed = parseResponsible(m.responsible);
    const responsiblesOnly: Record<string, string> = {};
    const activeServices: Record<string, boolean> = {};
    SERVICES.forEach(srv => {
      responsiblesOnly[srv.code] = parsed[srv.code] || '';
      activeServices[srv.code] = parsed._activeServices?.[srv.code] !== false;
    });
    
    setFormResponsibles(responsiblesOnly);
    setFormActiveServices(activeServices);
    setFormPhone(m.phone);
    setFormEmail(m.email);
    setFormObservations(m.observations || '');
    setModalError(null);
    setIsModalOpen(true);
  };

  const openCloneModal = (m: Municipality) => {
    setEditingId(null);
    setIsCloning(true);
    setFormName('');
    setFormState(m.state);
    
    const parsed = parseResponsible(m.responsible);
    const responsiblesOnly: Record<string, string> = {};
    const activeServices: Record<string, boolean> = {};
    SERVICES.forEach(srv => {
      responsiblesOnly[srv.code] = parsed[srv.code] || '';
      activeServices[srv.code] = parsed._activeServices?.[srv.code] !== false;
    });
    
    setFormResponsibles(responsiblesOnly);
    setFormActiveServices(activeServices);
    setFormPhone(m.phone);
    setFormEmail(m.email);
    setFormObservations(m.observations || '');
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formState) {
      setModalError('Por favor, informe o nome do município.');
      return;
    }

    setSubmitting(true);
    setModalError(null);
    try {
      const url = editingId ? `/api/municipalities/${editingId}` : '/api/municipalities';
      const method = editingId ? 'PUT' : 'POST';

      const saveResponsible = {
        ...formResponsibles,
        _activeServices: formActiveServices
      };

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formName,
          state: formState,
          responsible: JSON.stringify(saveResponsible),
          phone: formPhone || '-',
          email: formEmail || 'contato@municipio.gov.br',
          observations: formObservations || '',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao salvar município.');
      }

      await fetchMunicipalities();
      onRefreshSpreadsheet(); // Ensure spreadsheet updates as new municipality generates rows
      setIsModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setModalError(err.message || 'Erro ao salvar.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (id: number, name: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmName(name);
    setDeleteError(null);
    setDeleting(false);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId === null) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await apiFetch(`/api/municipalities/${deleteConfirmId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Não foi possível excluir o município.');
      }

      setDeleteConfirmId(null);
      await fetchMunicipalities();
      onRefreshSpreadsheet();
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || 'Erro ao excluir município.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredMuns = muns.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.state.toLowerCase().includes(q) ||
      m.responsible.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.phone.includes(q)
    );
  });

  const BrazilianStates = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cadastro de Municípios</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Gerencie os municípios, os responsáveis técnicos e suas informações de contato.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Add Employee Inline Form */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg p-1 bg-white dark:bg-gray-850 shadow-xs">
              <input
                type="text"
                placeholder="Novo funcionário..."
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddEmployeeClick();
                }}
                className="px-2.5 py-1 text-xs bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden w-40"
              />
              <button
                type="button"
                onClick={handleAddEmployeeClick}
                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-600 dark:bg-blue-950/40 dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white font-bold rounded text-xs transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus size={12} /> Cadastrar
              </button>
            </div>
            {employeeError && (
              <span className="text-[10px] text-red-500 font-semibold">{employeeError}</span>
            )}
          </div>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg inline-flex items-center gap-2 cursor-pointer text-xs transition-colors shadow-xs h-[38px]"
          >
            <Plus size={16} /> Novo Município
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
        <input
          type="text"
          placeholder="Pesquise por nome, estado, responsável, e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-shadow"
        />
      </div>

      {/* States summary stats */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="font-semibold">Municípios cadastrados:</span>
        <span className="bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 rounded-full text-gray-700 dark:text-gray-300 font-bold">{muns.length}</span>
      </div>

      {/* Loader / Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
          <p className="text-gray-500 dark:text-gray-400">Carregando municípios...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      ) : filteredMuns.length === 0 ? (
        <div className="p-12 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhum município localizado.</p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-blue-600 hover:text-blue-700 font-medium text-sm cursor-pointer"
            >
              Limpar Pesquisa
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMuns.map((m) => (
            <div
              key={m.id}
              className="p-6 bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-850 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-slate-300 dark:hover:border-gray-750 transition-all duration-200 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {m.name}
                    </h3>
                    <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md font-bold text-xs uppercase">
                      {m.state}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openCloneModal(m)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-emerald-650 dark:text-gray-400 dark:hover:text-emerald-400 rounded-md cursor-pointer transition-colors"
                      title="Clonar Município"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={() => openEditModal(m)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-md cursor-pointer transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(m.id, m.name)}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded-md cursor-pointer transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* List of services and assigned technical employee */}
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Funcionários Responsáveis por Serviço
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                    {SERVICES.map((srv) => {
                      const respMap = parseResponsible(m.responsible);
                      const isActive = !respMap._activeServices || respMap._activeServices[srv.code] !== false;
                      const respName = isActive ? (respMap[srv.code] || '-') : 'Não se aplica';
                      return (
                        <div key={srv.code} className={`flex justify-between items-center gap-1 bg-gray-50/50 dark:bg-gray-800/50 px-1.5 py-1 rounded transition-opacity ${!isActive ? 'opacity-35 line-through decoration-gray-400' : ''}`}>
                          <span className="text-gray-500 dark:text-gray-400 font-medium truncate" title={srv.name}>
                            {srv.code}:
                          </span>
                          <span className="font-bold text-gray-800 dark:text-gray-200 truncate" title={respName}>
                            {respName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Registry Modal (Add / Edit) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xl max-w-lg w-full overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/80">
              <h3 className="font-bold text-gray-950 dark:text-white text-base">
                {editingId ? 'Editar Município' : isCloning ? 'Clonar Cadastro de Município' : 'Cadastrar Novo Município'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {isCloning && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-400 flex items-start gap-2.5">
                  <Copy size={16} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Modo de Clonagem Ativo</span>
                    Os funcionários responsáveis foram pré-preenchidos. Insira o nome do novo município para concluir o clone.
                  </div>
                </div>
              )}
              {modalError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                    Nome do Município <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: São Paulo"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-shadow"
                  />
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                    Estado <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formState}
                    onChange={(e) => setFormState(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden transition-shadow"
                  >
                    {BrazilianStates.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Technical Staff list per service */}
              <div className="space-y-3.5 border-t border-gray-100 dark:border-gray-700 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Responsáveis por Serviço (Funcionários)
                  </p>
                  
                  {/* Inline add employee inside the modal */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Adicionar funcionário..."
                      value={modalNewEmpName}
                      onChange={(e) => setModalNewEmpName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleModalAddEmployee();
                        }
                      }}
                      className="px-2 py-1 text-[10px] border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-850 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden w-36"
                    />
                    <button
                      type="button"
                      onClick={handleModalAddEmployee}
                      className="px-2 py-1 bg-blue-50 hover:bg-blue-600 dark:bg-blue-950/40 dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white font-bold rounded text-[10px] transition-colors cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {SERVICES.map((srv) => {
                    const isActive = formActiveServices[srv.code] !== false;
                    return (
                      <div key={srv.code} className="relative">
                        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={(e) => {
                              setFormActiveServices({
                                ...formActiveServices,
                                [srv.code]: e.target.checked
                              });
                            }}
                            className="rounded-sm border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="truncate" title={srv.name}>{srv.name}</span>
                        </label>
                        <button
                          type="button"
                          disabled={!isActive}
                          onClick={() => setOpenDropdown(openDropdown === srv.code ? null : srv.code)}
                          className={`w-full px-2.5 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-left flex items-center justify-between min-h-[34px] transition-shadow ${
                            !isActive
                              ? 'bg-gray-100 dark:bg-gray-850 text-gray-400 dark:text-gray-500 cursor-not-allowed opacity-60'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer'
                          }`}
                        >
                          <span className="truncate pr-2">
                            {!isActive ? 'Não se aplica / Inativo' : getSelectedLabel(srv.code)}
                          </span>
                          <ChevronDown size={14} className="text-gray-400 shrink-0" />
                        </button>

                        {isActive && openDropdown === srv.code && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenDropdown(null)}
                            />
                            <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-40 max-h-44 overflow-y-auto p-1.5 space-y-0.5 text-xs">
                              {employees.map((emp) => {
                                const isChecked = isEmployeeChecked(srv.code, emp);
                                return (
                                  <label
                                    key={emp}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-gray-700 rounded-md cursor-pointer select-none text-gray-700 dark:text-gray-300 font-medium"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleEmployeeToggle(srv.code, emp)}
                                      className="rounded-sm border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-0 cursor-pointer"
                                    />
                                    <span className="truncate">{emp}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg inline-flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Salvando...
                    </>
                  ) : (
                    'Salvar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-red-50/50 dark:bg-red-950/10">
              <h3 className="font-bold text-red-700 dark:text-red-400 text-base flex items-center gap-2">
                <AlertCircle size={18} /> Confirmar Exclusão
              </h3>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-md"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                Tem certeza que deseja excluir o município <strong className="text-gray-900 dark:text-white font-semibold">"{deleteConfirmName}"</strong>?
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-400">
                <strong>Atenção:</strong> Todas as tarefas, históricos de alteração, comentários e anexos vinculados a este município serão apagados permanentemente e esta ação <strong>não pode ser desfeita</strong>.
              </div>

              {deleteError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{deleteError}</span>
                </div>
              )}
              
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition-colors cursor-pointer text-sm"
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg inline-flex items-center gap-2 cursor-pointer transition-colors text-sm disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Excluindo...
                    </>
                  ) : (
                    'Excluir permanentemente'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default MunicipalitiesView;
