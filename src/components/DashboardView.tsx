import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.ts';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line
} from 'recharts';
import {
  Loader2,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Users,
  Briefcase,
  TrendingUp,
  Award,
  Clock,
  Activity,
  CheckCircle
} from 'lucide-react';
import { STATUS_COLORS, StatusType, OBLIGATIONS, COMPETENCES } from '../types.ts';

interface DashboardViewProps {
  token: string | null;
}

interface ResponsibleStat {
  name: string;
  Concluido: number;
  Pendente: number;
  Total: number;
  TaxaConclusao: number;
  MunicipiosAtendidos: string[];
  QtdMunicipios: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ token }) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [selectedServicePeriods, setSelectedServicePeriods] = useState<Record<string, string>>({
    MSC: 'Todos',
    RREO: 'Todos',
    RGF: 'Todos',
    DCA: 'Todos',
    SIOPE: 'Todos',
    SIOPS: 'Todos',
  });

  const fetchStats = async (yearValue = selectedYear) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/stats?year=${yearValue}`);
      if (!res.ok) {
        throw new Error('Falha ao buscar dados do servidor');
      }
      const data = await res.json();
      setStats(data);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao carregar estatísticas. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchStats(selectedYear);
    }
  }, [token, selectedYear]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 min-h-[400px]">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-gray-500 dark:text-gray-400 font-medium">Carregando dados consolidados do dashboard...</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Sincronizando tarefas e indicadores de desempenho</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl text-center shadow-sm mt-12">
        <AlertTriangle className="text-red-600 dark:text-red-400 mx-auto mb-4" size={44} />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Erro ao carregar indicadores</h3>
        <p className="text-red-700 dark:text-red-300 text-sm mb-6">{error || 'Erro inesperado ao conectar ao banco de dados.'}</p>
        <button
          onClick={fetchStats}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl inline-flex items-center gap-2 cursor-pointer transition-all font-semibold text-sm shadow-md shadow-red-600/10 active:scale-98"
        >
          <RefreshCw size={16} /> Tentar Novamente
        </button>
      </div>
    );
  }

  // Formatting status data for Recharts Pie Chart
  const statusPieData = Object.entries(stats.statusCounts).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLORS[name as StatusType] || '#CBD5E1',
  })).filter(item => (item.value as number) > 0);

  // Formatting stats by obligation
  const obligationChartData = Object.entries(stats.obligationStats).map(([name, counts]: any) => ({
    name,
    Concluido: counts.Concluido || counts['Concluído'] || 0,
    Pendente: counts.Pendente || counts['Pendente'] || 0,
  }));

  // Formatting stats by municipality (taking top 10 for readability)
  const municipalityChartData = Object.entries(stats.municipalityStats).map(([name, counts]: any) => ({
    name,
    Concluido: counts.Concluido || counts['Concluído'] || 0,
    Pendente: counts.Pendente || counts['Pendente'] || 0,
  })).slice(0, 10);

  // Formatting stats by competence
  const competenceChartData = Object.entries(stats.competenceStats).map(([name, counts]: any) => ({
    name,
    Concluido: counts.Concluido || counts['Concluído'] || 0,
    Pendente: counts.Pendente || counts['Pendente'] || 0,
  }));

  // Performance stats per service type with per-service period filtering
  const parsedObligationStats = OBLIGATIONS.map(ob => {
    const period = selectedServicePeriods[ob.code] || 'Todos';
    let concluidos = 0;
    let pendentes = 0;
    const compStats = stats.obligationCompetenceStats?.[ob.code] || {};

    if (period === 'Todos') {
      Object.values(compStats).forEach((counts: any) => {
        concluidos += counts.Concluido || counts['Concluído'] || 0;
        pendentes += counts.Pendente || 0;
      });
      if (concluidos === 0 && pendentes === 0) {
        const counts = stats.obligationStats?.[ob.code] || {};
        concluidos = counts.Concluido || counts['Concluído'] || 0;
        pendentes = counts.Pendente || counts['Pendente'] || 0;
      }
    } else {
      const counts = compStats[period] || { Concluido: 0, Pendente: 0 };
      concluidos = counts.Concluido || counts['Concluído'] || 0;
      pendentes = counts.Pendente || 0;
    }

    const total = concluidos + pendentes;
    const taxa = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    return {
      code: ob.code,
      name: ob.name,
      concluidos,
      pendentes,
      total,
      taxa,
    };
  });

  const getObligationColor = (code: string) => {
    switch (code) {
      case 'MSC': return { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', lightBg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-900/30' };
      case 'RREO': return { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', lightBg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-900/30' };
      case 'RGF': return { bg: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-400', lightBg: 'bg-purple-50 dark:bg-purple-950/20', border: 'border-purple-200 dark:border-purple-900/30' };
      case 'SIOPE': return { bg: 'bg-orange-500', text: 'text-orange-700 dark:text-orange-400', lightBg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-900/30' };
      case 'SIOPS': return { bg: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400', lightBg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200 dark:border-rose-900/30' };
      case 'DCA': return { bg: 'bg-stone-500', text: 'text-stone-700 dark:text-stone-400', lightBg: 'bg-stone-100/60 dark:bg-stone-900/20', border: 'border-stone-200 dark:border-stone-900/30' };
      default: return { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', lightBg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-900/30' };
    }
  };

  // Responsible stats from stats api or empty array
  const rawResponsibleStats: ResponsibleStat[] = stats.responsibleStats || [];

  // Filter responsibles based on search input
  const filteredEmployees = rawResponsibleStats.filter(emp =>
    emp.name.toLowerCase().includes(searchEmployee.toLowerCase())
  );

  // Performance Highlights calculations
  const totalEmployees = rawResponsibleStats.length;
  
  // Top performer (Highest completion rate, with at least 1 task)
  const topPerformer = rawResponsibleStats
    .filter(emp => emp.Total > 0)
    .reduce<ResponsibleStat | null>((best, curr) => {
      if (!best) return curr;
      if (curr.TaxaConclusao > best.TaxaConclusao) return curr;
      if (curr.TaxaConclusao === best.TaxaConclusao && curr.Total > best.Total) return curr;
      return best;
    }, null);

  // Highest workload (Most municipalities managed)
  const heaviestWorkload = rawResponsibleStats.reduce<ResponsibleStat | null>((most, curr) => {
    if (!most) return curr;
    if (curr.QtdMunicipios > most.QtdMunicipios) return curr;
    return most;
  }, null);

  // Helper to generate initials for avatar
  const getInitials = (fullName: string) => {
    const parts = fullName.trim().split(' ');
    if (parts.length === 0 || !parts[0]) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Helper to color background of avatar based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    ];
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
      sum += name.charCodeAt(i);
    }
    return colors[sum % colors.length];
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 dark:border-gray-800 pb-5">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white">Indicadores de Desempenho</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Acompanhamento e análise de performance das obrigações e servidores municipais.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl px-3 py-2 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Exercício:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-gray-950 dark:text-white focus:outline-hidden cursor-pointer"
            >
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
            </select>
          </div>

          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium inline-flex items-center gap-1.5 bg-slate-50 dark:bg-gray-850 px-2.5 py-1.5 rounded-lg border border-slate-200/40 dark:border-gray-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Dados Atualizados
          </span>
          <button
            onClick={() => fetchStats(selectedYear)}
            className="px-4 py-2 bg-white hover:bg-slate-50 dark:bg-gray-900 dark:hover:bg-gray-800 border border-slate-200 dark:border-gray-800 rounded-xl text-gray-700 dark:text-gray-300 text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm transition-all hover:border-slate-300 dark:hover:border-gray-750 active:scale-98"
            title="Sincronizar Dados"
          >
            <RefreshCw size={14} className="text-gray-500" />
            Atualizar Dashboard
          </button>
        </div>
      </div>

      {/* Overdue Services Control Section */}
      {(() => {
        const overdueStats = stats.overdueStats || {
          totalOverdue: 0,
          overdueByObligation: {},
          overdueByMunicipality: {},
          overdueByResponsible: {},
        };
        const hasOverdue = overdueStats.totalOverdue > 0;

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-gray-800/60 pb-2">
              <Clock size={16} className={hasOverdue ? "text-red-500 animate-pulse" : "text-emerald-500"} />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Controle de Prazos e Vencimentos
              </h3>
            </div>

            {hasOverdue ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Highlight Card */}
                <div className="lg:col-span-1 p-6 bg-gradient-to-br from-red-50 to-white dark:from-red-950/15 dark:to-gray-900 border border-red-150 dark:border-red-900/30 rounded-2xl flex flex-col justify-between shadow-[0_4px_16px_rgba(239,68,68,0.03)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.06)] transition-all duration-300">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl">
                        <AlertTriangle size={22} className="animate-bounce" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-100/50 dark:bg-red-950/50 px-2.5 py-1 rounded-full border border-red-200/50">
                        Atenção
                      </span>
                    </div>
                    <p className="text-xs text-red-700/80 dark:text-red-400/80 font-bold uppercase tracking-wider">
                      Serviços Vencidos
                    </p>
                    <p className="text-4xl font-black text-red-600 dark:text-red-400 mt-2 tracking-tight">
                      {overdueStats.totalOverdue}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                      Existem obrigações pendentes que ultrapassaram o último dia do mês subsequente ao período de competência.
                    </p>
                  </div>
                  <div className="mt-5 pt-4 border-t border-red-150/50 dark:border-red-900/30">
                    <span className="text-[10px] font-bold text-red-700 dark:text-red-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      Requer Ação Imediata
                    </span>
                  </div>
                </div>

                {/* Overdue by Obligation */}
                <div className="p-5 bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-300">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
                    <Layers size={13} className="text-amber-500" />
                    Vencidos por Serviço
                  </h4>
                  <div className="space-y-4 max-h-[180px] overflow-y-auto pr-1">
                    {Object.entries(overdueStats.overdueByObligation).length > 0 ? (
                      Object.entries(overdueStats.overdueByObligation)
                        .sort((a: any, b: any) => b[1] - a[1])
                        .map(([code, count]: any) => (
                          <div key={code} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-gray-800 dark:text-gray-200">{code}</span>
                              <span className="font-black text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-150/30">{count} {count === 1 ? 'pendente' : 'pendentes'}</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-red-500 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, (count / overdueStats.totalOverdue) * 100)}%` }} 
                              />
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic py-4 text-center">Nenhum serviço vencido</p>
                    )}
                  </div>
                </div>

                {/* Overdue by Municipality */}
                <div className="p-5 bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-300">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
                    <Briefcase size={13} className="text-emerald-500" />
                    Municípios mais Críticos
                  </h4>
                  <div className="space-y-3.5 max-h-[180px] overflow-y-auto pr-1">
                    {Object.entries(overdueStats.overdueByMunicipality).length > 0 ? (
                      Object.entries(overdueStats.overdueByMunicipality)
                        .sort((a: any, b: any) => b[1] - a[1])
                        .slice(0, 5)
                        .map(([name, count]: any) => (
                          <div key={name} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={name}>
                              {name}
                            </span>
                            <span className="font-black text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded border border-red-150/30 shrink-0">
                              {count}
                            </span>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic py-4 text-center">Nenhum município com pendências</p>
                    )}
                  </div>
                </div>

                {/* Overdue by Responsible */}
                <div className="p-5 bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-300">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 flex items-center gap-1.5">
                    <Users size={13} className="text-purple-500" />
                    Pendentes por Responsável
                  </h4>
                  <div className="space-y-3.5 max-h-[180px] overflow-y-auto pr-1">
                    {Object.entries(overdueStats.overdueByResponsible).length > 0 ? (
                      Object.entries(overdueStats.overdueByResponsible)
                        .sort((a: any, b: any) => b[1] - a[1])
                        .map(([name, count]: any) => (
                          <div key={name} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[150px]" title={name}>
                              {name}
                            </span>
                            <span className="font-black text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded border border-amber-150/30 shrink-0">
                              {count}
                            </span>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic py-4 text-center">Tudo em dia para a equipe</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-gradient-to-r from-emerald-500/10 via-emerald-500/[0.02] to-transparent border border-emerald-500/20 rounded-2xl flex items-center gap-4 shadow-sm">
                <div className="p-3 bg-emerald-500 text-white rounded-xl">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Excelente trabalho! Tudo em dia.</h4>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-500/80 mt-1">
                    Não existem obrigações em atraso no sistema para nenhuma das competências cadastradas. Todos os prazos estão sendo cumpridos!
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Performance by Service Type Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-gray-800/60 pb-2">
          <Activity size={16} className="text-blue-500" />
          <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">Desempenho por Tipo de Serviço</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {parsedObligationStats.map((ob) => {
            const colors = getObligationColor(ob.code);
            return (
              <div 
                key={ob.code}
                className="p-5 bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text} ${colors.lightBg} px-2.5 py-1 rounded-md border ${colors.border}`}>
                      {ob.code}
                    </span>
                    <select
                      value={selectedServicePeriods[ob.code] || 'Todos'}
                      onChange={(e) => setSelectedServicePeriods(prev => ({ ...prev, [ob.code]: e.target.value }))}
                      className="text-[10px] font-semibold bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-2 py-0.5 text-gray-700 dark:text-gray-300 cursor-pointer focus:outline-hidden"
                    >
                      <option value="Todos">Todos os Períodos</option>
                      {(COMPETENCES[ob.code] || []).map(comp => (
                        <option key={comp} value={comp}>{comp}</option>
                      ))}
                    </select>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white truncate" title={ob.name}>
                    {ob.name}
                  </h4>
                  
                  <div className="flex items-center justify-between mt-4 mb-2">
                    <span className={`text-xl font-black ${colors.text}`}>{ob.taxa}%</span>
                    <span className="text-[10px] font-medium text-gray-400">concluído</span>
                  </div>
                  
                  <div className="w-full h-2 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${colors.bg}`} 
                      style={{ width: `${ob.taxa}%` }} 
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-150/40 dark:border-gray-800/80 mt-4 pt-3 text-xs font-semibold">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {ob.concluidos} Concluídas
                  </span>
                  <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    {ob.pendentes} Pendentes
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid Status Counts */}
      <div className="bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 p-6 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] transition-colors duration-300">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">Detalhamento Geral por Status</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
          {Object.entries(STATUS_COLORS).map(([name, color]) => {
            const count = stats.statusCounts[name] || 0;
            return (
              <div
                key={name}
                className="p-4 border border-slate-100 dark:border-gray-800 bg-slate-50/30 dark:bg-gray-900/50 hover:bg-slate-50 dark:hover:bg-gray-800/70 rounded-xl flex flex-col items-center justify-center text-center transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
              >
                <span className="w-3 h-3 rounded-full mb-2.5 shadow-sm" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-600 dark:text-gray-400 font-semibold truncate w-full">{name}</span>
                <span className="text-xl font-extrabold text-gray-900 dark:text-white mt-1.5">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* STAFF / EMPLOYEE ANALYSIS SECTION (ANÁLISE DOS FUNCIONÁRIOS / RESPONSÁVEIS) */}
      <div className="border-t border-slate-100 dark:border-gray-800 pt-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-3 py-1 rounded-md border border-blue-200/30 dark:border-blue-900/30">Módulo de Pessoas</span>
            <h3 className="text-xl font-black text-gray-900 dark:text-white mt-2">Desempenho por Servidor / Responsável</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Produtividade, carga de trabalho e índices de conclusão por colaborador.</p>
          </div>
          <div className="w-full lg:w-72">
            <input
              type="text"
              placeholder="Pesquisar funcionário..."
              value={searchEmployee}
              onChange={(e) => setSearchEmployee(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-900 dark:text-white transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Staff Performance Highlights */}
        {totalEmployees > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
            {/* High Performance Leader */}
            <div className="p-5 bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-950/10 dark:to-gray-900 border border-emerald-100/50 dark:border-emerald-900/20 rounded-2xl flex items-start gap-4">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-xl mt-0.5">
                <Award size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Líder de Entregas</span>
                <span className="text-base font-bold text-gray-900 dark:text-white mt-1 block truncate">
                  {topPerformer ? topPerformer.name : 'Ninguém registrado'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                  {topPerformer ? `${topPerformer.TaxaConclusao}% de aproveitamento (${topPerformer.Concluido}/${topPerformer.Total} concluidas)` : 'Crie municípios e tarefas para analisar.'}
                </span>
              </div>
            </div>

            {/* Heaviest Workload */}
            <div className="p-5 bg-gradient-to-br from-blue-50/40 to-white dark:from-blue-950/10 dark:to-gray-900 border border-blue-100/50 dark:border-blue-900/20 rounded-2xl flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-xl mt-0.5">
                <Briefcase size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Maior Portfólio</span>
                <span className="text-base font-bold text-gray-900 dark:text-white mt-1 block truncate">
                  {heaviestWorkload ? heaviestWorkload.name : 'Ninguém registrado'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                  {heaviestWorkload ? `Gerencia ${heaviestWorkload.QtdMunicipios} municípios (${heaviestWorkload.Total} tarefas totais)` : '-'}
                </span>
              </div>
            </div>

            {/* Mid Stats */}
            <div className="p-5 bg-gradient-to-br from-violet-50/40 to-white dark:from-violet-950/10 dark:to-gray-900 border border-violet-100/50 dark:border-violet-900/20 rounded-2xl flex items-start gap-4">
              <div className="p-3 bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400 rounded-xl mt-0.5">
                <Users size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider block">Equipe Responsável</span>
                <span className="text-base font-bold text-gray-900 dark:text-white mt-1 block">
                  {totalEmployees} Colaboradores
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">
                  Média de {Math.round(stats.totalTasks / (totalEmployees || 1))} tarefas e obrigações por servidor.
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Responsible Performance Charts */}
        {filteredEmployees.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 p-6 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col h-[380px] transition-colors duration-300">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
                <TrendingUp size={16} className="text-blue-500" />
                Carga de Trabalho vs Conclusão e Taxa de Eficiência (%)
              </h4>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={filteredEmployees}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#64748B" fontSize={11} label={{ value: 'Quantidade de Obrigações', angle: -90, position: 'insideLeft', style: { fill: '#64748B', fontSize: 10, fontWeight: 'bold' } }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10B981" fontSize={11} domain={[0, 100]} label={{ value: 'Eficiência %', angle: 90, position: 'insideRight', style: { fill: '#10B981', fontSize: 10, fontWeight: 'bold' } }} />
                    <Tooltip contentStyle={{ borderRadius: '12px' }} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="Total" name="Tarefas Totais" fill="#3B82F6" opacity={0.8} radius={[4, 4, 0, 0]} barSize={35} />
                    <Bar yAxisId="left" dataKey="Concluido" name="Tarefas Concluídas" fill="#10B981" radius={[4, 4, 0, 0]} barSize={25} />
                    <Line yAxisId="right" type="monotone" dataKey="TaxaConclusao" name="Taxa de Conclusão (%)" stroke="#F59E0B" strokeWidth={3} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : null}

        {/* Table of Employees */}
        <div className="bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] overflow-hidden transition-colors duration-300">
          {filteredEmployees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-gray-850/40 border-b border-slate-150 dark:border-gray-800 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Funcionário / Responsável</th>
                    <th className="py-4 px-4 text-center">Municípios Atendidos</th>
                    <th className="py-4 px-4 text-center">Total de Obrigações</th>
                    <th className="py-4 px-4 text-center">Status das Tarefas</th>
                    <th className="py-4 px-6 text-right">Eficiência / Progresso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 text-sm">
                  {filteredEmployees.map((emp) => {
                    // Color bar based on rating
                    let progressColor = 'bg-rose-500';
                    let progressBg = 'bg-rose-100 dark:bg-rose-950/40';
                    let textRatingColor = 'text-rose-600 dark:text-rose-400';
                    if (emp.TaxaConclusao >= 75) {
                      progressColor = 'bg-emerald-500';
                      progressBg = 'bg-emerald-100 dark:bg-emerald-950/40';
                      textRatingColor = 'text-emerald-600 dark:text-emerald-400';
                    } else if (emp.TaxaConclusao >= 40) {
                      progressColor = 'bg-amber-500';
                      progressBg = 'bg-amber-100 dark:bg-amber-950/40';
                      textRatingColor = 'text-amber-600 dark:text-amber-400';
                    }

                    return (
                      <tr key={emp.name} className="hover:bg-slate-50/30 dark:hover:bg-gray-850/20 transition-colors">
                        {/* Name & Avatar */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-xs shadow-sm shrink-0 ${getAvatarColor(emp.name)}`}>
                              {getInitials(emp.name)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-gray-900 dark:text-white block hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer">{emp.name}</span>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {emp.MunicipiosAtendidos.slice(0, 3).map((mName) => (
                                  <span key={mName} className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-md">
                                    {mName}
                                  </span>
                                ))}
                                {emp.MunicipiosAtendidos.length > 3 ? (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md">
                                    +{emp.MunicipiosAtendidos.length - 3}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Managed Count */}
                        <td className="py-4 px-4 text-center">
                          <div className="inline-flex items-center justify-center px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full font-extrabold text-xs">
                            {emp.QtdMunicipios} {emp.QtdMunicipios === 1 ? 'município' : 'municípios'}
                          </div>
                        </td>

                        {/* Total Count */}
                        <td className="py-4 px-4 text-center">
                          <span className="font-extrabold text-gray-850 dark:text-gray-250">{emp.Total}</span>
                        </td>

                        {/* Tasks Concluded vs Pending */}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-3.5 text-xs">
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {emp.Concluido} Concluídas
                            </span>
                            <span className="inline-flex items-center gap-1 font-bold text-amber-500 dark:text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              {emp.Pendente} Pendentes
                            </span>
                          </div>
                        </td>

                        {/* Efficiency bar */}
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex flex-col items-end w-40">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className={`text-xs font-black ${textRatingColor}`}>{emp.TaxaConclusao}%</span>
                              <span className="text-[10px] font-medium text-gray-400">concluído</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-500 ${progressColor}`} style={{ width: `${emp.TaxaConclusao}%` }} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <Users className="mx-auto text-gray-300 dark:text-gray-600 mb-3" size={40} />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Nenhum funcionário encontrado.</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Insira responsabilidades nos municípios para vê-los aqui.</p>
            </div>
          )}
        </div>
      </div>

      {/* Visual Charts Grid (Existing Charts updated to fit flawlessly) */}
      <div className="border-t border-slate-100 dark:border-gray-800 pt-8">
        <h3 className="text-lg font-black text-gray-900 dark:text-white mb-5 uppercase tracking-wide">Distribuição das Obrigações</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart Status */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 p-6 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col h-[400px] transition-colors duration-300">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <Activity size={16} className="text-indigo-500" />
              Distribuição por Status Principal
            </h4>
            <div className="flex-1 flex items-center justify-center relative min-h-0">
              {statusPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="48%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} tarefas`, 'Quantidade']} contentStyle={{ borderRadius: '12px' }} />
                    <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">Sem dados de tarefas para exibir.</p>
              )}
            </div>
          </div>

          {/* Bar Chart by Obligation */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 p-6 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col h-[400px] transition-colors duration-300">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-500" />
              Progresso por Obrigação
            </h4>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={obligationChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="Concluido" name="Concluído (Enviado/Homologado)" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="Pendente" name="Pendente" fill="#EF4444" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart by Competence */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 p-6 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col h-[400px] lg:col-span-2 transition-colors duration-300">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              Progresso por Competência
            </h4>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={competenceChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} angle={-15} textAnchor="end" height={50} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                  <Bar dataKey="Concluido" name="Concluído" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Pendente" name="Pendente" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart by Municipality */}
          <div className="bg-white dark:bg-gray-900 border border-slate-200/50 dark:border-gray-800 p-6 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.01)] flex flex-col h-[400px] lg:col-span-2 transition-colors duration-300">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center gap-2">
              <Layers size={16} className="text-blue-500" />
              Progresso por Município (Top 10)
            </h4>
            <div className="flex-1 min-h-0">
              {municipalityChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={municipalityChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" stroke="#94A3B8" fontSize={11} />
                    <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={11} width={120} />
                    <Tooltip contentStyle={{ borderRadius: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                    <Bar dataKey="Concluido" name="Concluído" fill="#10B981" radius={[0, 4, 4, 0]} stackId="a" />
                    <Bar dataKey="Pendente" name="Pendente" fill="#EF4444" radius={[0, 4, 4, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500 dark:text-gray-400 text-sm">Sem municípios cadastrados.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
