import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { SpreadsheetView } from './components/SpreadsheetView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { MunicipalitiesView, EMPLOYEES } from './components/MunicipalitiesView.tsx';
import { Loader2, LogOut, Table, BarChart3, Building2, UserCheck, ShieldCheck } from 'lucide-react';

function DashboardApp() {
  const { user, token, profile, logout, loading, linkEmployee } = useAuth();
  const [activeTab, setActiveTab] = useState<'planilha' | 'dashboard' | 'municipios'>('planilha');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    // Force reset to light mode if it was dark to fulfill the user's explicit request immediately, default to false
    if (saved === 'dark' || !saved) {
      localStorage.setItem('theme', 'light');
      return false;
    }
    return saved === 'dark';
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Apply dark mode theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const handleRefreshSpreadsheet = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-zinc-650 dark:text-zinc-400 mb-3" size={36} />
        <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">Carregando sistema...</p>
      </div>
    );
  }

  // Beautiful login view
  if (!user || !token) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center px-4 transition-colors duration-300">
        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg mb-1">
              <Table size={28} />
            </div>
            <h1 className="text-xl font-black tracking-widest text-gray-950 dark:text-white uppercase">
              MunicípioCloud
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              Acompanhamento e controle anual das obrigações municipais de forma automatizada, ágil e online.
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg space-y-2 text-xs border border-gray-200 dark:border-gray-800">
            <p className="font-bold text-gray-900 dark:text-gray-300 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <ShieldCheck size={14} className="text-gray-900 dark:text-gray-350" /> Acesso Restrito
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              Entre com seu e-mail e senha cadastrados ou crie uma nova conta de acesso ao painel de obrigações municipais.
            </p>
          </div>

          <AuthForm />

          <div className="flex items-center justify-between text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            <span>MUNICÍPIOCLOUD v1.0.0</span>
            <span>© 2026 Todos os direitos reservados</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col md:flex-row">
      
      {/* Left Sidebar for Desktop */}
      <aside className="hidden md:flex md:w-60 md:flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 shrink-0 h-screen sticky top-0 justify-between">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 min-h-[80px] flex flex-col justify-center">
            <h1 className="font-extrabold text-gray-900 dark:text-white text-sm uppercase tracking-widest">
              MunicípioCloud
            </h1>
            <p className="text-[9px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-widest mt-0.5">
              Obrigações Municipais
            </p>
            <div className="mt-3 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 rounded-lg flex items-center justify-between">
              <span className="text-[9px] font-bold text-amber-850 dark:text-amber-450 uppercase tracking-wider">Exercício</span>
              <span className="text-xs font-black text-amber-900 dark:text-amber-300">2026</span>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <nav className="py-4 space-y-1">
            <button
              onClick={() => setActiveTab('planilha')}
              className={`w-full px-6 py-3 text-left text-xs font-semibold cursor-pointer transition-colors flex items-center gap-3 ${
                activeTab === 'planilha'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-950 dark:text-white font-bold border-r-2 border-gray-950 dark:border-white'
                  : 'text-gray-500 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Table size={16} /> Planilha Principal
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full px-6 py-3 text-left text-xs font-semibold cursor-pointer transition-colors flex items-center gap-3 ${
                activeTab === 'dashboard'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-950 dark:text-white font-bold border-r-2 border-gray-950 dark:border-white'
                  : 'text-gray-500 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 size={16} /> Dashboards
            </button>
            <button
              onClick={() => setActiveTab('municipios')}
              className={`w-full px-6 py-3 text-left text-xs font-semibold cursor-pointer transition-colors flex items-center gap-3 ${
                activeTab === 'municipios'
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-950 dark:text-white font-bold border-r-2 border-gray-950 dark:border-white'
                  : 'text-gray-500 hover:bg-gray-50/50 dark:hover:bg-gray-800/40 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Building2 size={16} /> Municípios
            </button>
          </nav>

          {/* Period Information in Sidebar */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800/80 mt-auto">
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
              Períodos
            </p>
            <div className="space-y-2">
              <div className="px-3 py-1.5 bg-amber-50/50 dark:bg-amber-950/20 border-l-[3px] border-amber-500 rounded-r-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <div className="text-left leading-none">
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">MSC</p>
                  <p className="text-[11px] font-bold text-gray-750 dark:text-gray-250 mt-0.5">Mensal</p>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 border-l-[3px] border-emerald-500 rounded-r-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <div className="text-left leading-none">
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">RREO</p>
                  <p className="text-[11px] font-bold text-gray-750 dark:text-gray-250 mt-0.5">Bimestral</p>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-purple-50/50 dark:bg-purple-950/20 border-l-[3px] border-purple-500 rounded-r-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <div className="text-left leading-none">
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">RGF</p>
                  <p className="text-[11px] font-bold text-gray-750 dark:text-gray-250 mt-0.5">Quadrimestral</p>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-orange-50/50 dark:bg-orange-950/20 border-l-[3px] border-orange-500 rounded-r-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <div className="text-left leading-none">
                  <p className="text-[9px] text-gray-400 dark:text-gray-550 font-bold uppercase tracking-wider">SIOPE/SIOPS</p>
                  <p className="text-[11px] font-bold text-gray-750 dark:text-gray-250 mt-0.5">Vinculadas</p>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-stone-100/60 dark:bg-stone-900/20 border-l-[3px] border-stone-500 rounded-r-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                <div className="text-left leading-none">
                  <p className="text-[9px] text-gray-400 dark:text-gray-550 font-bold uppercase tracking-wider">DCA</p>
                  <p className="text-[11px] font-bold text-gray-750 dark:text-gray-250 mt-0.5">Anual</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer - User details & Logout */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-gray-700">
              {(user.name || user.email || 'U')[0].toUpperCase()}
            </div>
            <div className="truncate flex-1">
              <p className="text-xs font-bold text-gray-900 dark:text-white truncate" title={user.name || ''}>
                {user.name || 'Usuário'}
              </p>
              <p className="text-[10px] text-gray-500 truncate" title={user.email || ''}>
                {user.email}
              </p>
            </div>
          </div>

          {/* Employee Link Selector */}
          <div className="px-2.5 py-2 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-lg">
            <label className="block text-[9px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
              <UserCheck size={11} className="text-gray-500 dark:text-gray-400" />
              Funcionário Vinculado
            </label>
            {user.email?.toLowerCase().trim() === 'comercialmetabit@gmail.com' ? (
              <div className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Administrador
                <span className="text-[8px] px-1 py-0.2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-450 border border-blue-200/40 dark:border-blue-900/40 rounded uppercase font-extrabold tracking-widest">
                  Fixo
                </span>
              </div>
            ) : (
              <select
                value={profile?.employeeName || ''}
                onChange={async (e) => {
                  try {
                    const selected = e.target.value;
                    await linkEmployee(selected || null);
                  } catch (err: any) {
                    alert(err.message || 'Erro ao vincular funcionário.');
                  }
                }}
                className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-hidden cursor-pointer"
              >
                <option value="">Não Vinculado</option>
                {EMPLOYEES.map((emp) => (
                  <option key={emp} value={emp}>
                    {emp}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />
            <button
              onClick={logout}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 rounded-lg cursor-pointer transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
              title="Sair da Conta"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Navigation Header */}
      <header className="md:hidden sticky top-0 z-40 w-full bg-white dark:bg-gray-900 border-b border-b-gray-200 dark:border-b-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-extrabold text-gray-900 dark:text-white text-xs uppercase tracking-wider">
            MunicípioCloud
          </h1>
        </div>

        {/* Tab Selection buttons for Mobile */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('planilha')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg cursor-pointer ${
              activeTab === 'planilha' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500'
            }`}
          >
            Dash
          </button>
          <button
            onClick={() => setActiveTab('municipios')}
            className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg cursor-pointer ${
              activeTab === 'municipios' ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' : 'text-gray-500'
            }`}
          >
            Muns
          </button>
          
          <button
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg cursor-pointer ml-1"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Main Content Area with optimized screen real estate to maximize vertical workspace */}
      <main className="flex-1 p-2.5 md:p-3.5 max-w-[1450px] w-full overflow-x-hidden">
        
        <div className="block">
          {activeTab === 'planilha' && (
            <SpreadsheetView token={token} refreshTrigger={refreshTrigger} />
          )}
          {activeTab === 'dashboard' && (
            <DashboardView token={token} />
          )}
          {activeTab === 'municipios' && (
            <MunicipalitiesView token={token} onRefreshSpreadsheet={handleRefreshSpreadsheet} />
          )}
        </div>
      </main>
    </div>
  );
}

function AuthForm() {
  const { login, register, loading } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [authError, setAuthError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!email || !password) {
      setAuthError('Preencha todos os campos obrigatórios.');
      return;
    }
    try {
      if (isRegisterMode) {
        await register(email, password, name || undefined, employeeName || undefined);
      } else {
        await login(email, password);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Ocorreu um erro ao realizar a autenticação.');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => {
            setIsRegisterMode(false);
            setAuthError('');
          }}
          className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            !isRegisterMode
              ? 'text-gray-900 dark:text-white border-b-2 border-gray-950 dark:border-white font-black'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => {
            setIsRegisterMode(true);
            setAuthError('');
          }}
          className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            isRegisterMode
              ? 'text-gray-900 dark:text-white border-b-2 border-gray-950 dark:border-white font-black'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          Cadastrar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {authError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded border border-red-200/50 dark:border-red-900/50">
            {authError}
          </div>
        )}

        {isRegisterMode && (
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-widest mb-1">
              Nome Completo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome"
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-3 py-2 text-xs focus:outline-hidden text-gray-900 dark:text-gray-100"
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-widest mb-1">
            E-mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Digite seu e-mail"
            required
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-3 py-2 text-xs focus:outline-hidden text-gray-900 dark:text-gray-100"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-widest mb-1">
            Senha
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            required
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-3 py-2 text-xs focus:outline-hidden text-gray-900 dark:text-gray-100"
          />
        </div>

        {isRegisterMode && (
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-widest mb-1">
              Vincular Funcionário (Opcional)
            </label>
            <select
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-850 rounded px-3 py-2 text-xs focus:outline-hidden text-gray-700 dark:text-gray-300"
            >
              <option value="">Não Vincular</option>
              {EMPLOYEES.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#111827] hover:bg-[#1f2937] text-white font-bold rounded-lg cursor-pointer transition-colors text-xs uppercase tracking-wider dark:bg-white dark:text-[#111827] dark:hover:bg-gray-100 disabled:opacity-50 mt-4"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              <span>Processando...</span>
            </>
          ) : (
            <span>{isRegisterMode ? 'Registrar e Entrar' : 'Entrar'}</span>
          )}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardApp />
    </AuthProvider>
  );
}
