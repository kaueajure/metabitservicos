import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { ThemeToggle } from './components/ThemeToggle.tsx';
import { SpreadsheetView } from './components/SpreadsheetView.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { MunicipalitiesView } from './components/MunicipalitiesView.tsx';
import { Loader2, LogOut, Table, BarChart3, Building2, UserCheck, ShieldCheck, Plus } from 'lucide-react';

function DashboardApp() {
  const { user, token, postgresUser, logout, loading, linkEmployee, employees, registerEmployee } = useAuth();
  const [activeTab, setActiveTab] = useState<'planilha' | 'dashboard' | 'municipios'>('planilha');
  const [showAddEmpInput, setShowAddEmpInput] = useState(false);
  const [newSidebarEmpName, setNewSidebarEmpName] = useState('');
  const [empRegisterError, setEmpRegisterError] = useState<string | null>(null);
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
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col">
      
      <div className="flex-1 flex flex-col min-h-screen">
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

        {/* Desktop Top Header Bar for Tabs */}
        <header className="hidden md:flex sticky top-0 z-40 w-full bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-2.5 items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-white">
              MunicípioCloud
            </span>
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/30 dark:border-blue-900/40 rounded uppercase font-black tracking-widest">
              2026
            </span>
          </div>

          {/* Desktop Horizontal Tabs Selection */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800/60 p-1 rounded-lg border border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setActiveTab('planilha')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'planilha'
                  ? 'bg-white dark:bg-gray-900 text-gray-950 dark:text-white shadow-xs font-black'
                  : 'text-gray-500 hover:text-gray-950 dark:hover:text-white'
              }`}
            >
              <Table size={14} /> Planilha Principal
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-white dark:bg-gray-900 text-gray-950 dark:text-white shadow-xs font-black'
                  : 'text-gray-500 hover:text-gray-950 dark:hover:text-white'
              }`}
            >
              <BarChart3 size={14} /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('municipios')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'municipios'
                  ? 'bg-white dark:bg-gray-900 text-gray-950 dark:text-white shadow-xs font-black'
                  : 'text-gray-500 hover:text-gray-950 dark:hover:text-white'
              }`}
            >
              <Building2 size={14} /> Municípios
            </button>
          </div>

          {/* Horizontal profile & Employee Link */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <ThemeToggle darkMode={darkMode} setDarkMode={setDarkMode} />

            {/* Employee Selector */}
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 px-2.5 py-1 rounded-lg">
              <span className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-wider flex items-center gap-1 shrink-0">
                <UserCheck size={11} className="text-gray-400 dark:text-gray-500" />
                Vínculo:
              </span>
              {user.email?.toLowerCase().trim() === 'comercialmetabit@gmail.com' ? (
                <div className="text-[11px] font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  Administrador
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <select
                    value={postgresUser?.employeeName || ''}
                    onChange={async (e) => {
                      try {
                        const selected = e.target.value;
                        await linkEmployee(selected || null);
                      } catch (err: any) {
                        alert(err.message || 'Erro ao vincular funcionário.');
                      }
                    }}
                    className="bg-transparent border-0 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">Não Vinculado</option>
                    {employees.map((emp) => (
                      <option key={emp} value={emp}>
                        {emp}
                      </option>
                    ))}
                  </select>
                  
                  {/* Plus button to add new employee */}
                  <div className="relative">
                    {!showAddEmpInput ? (
                      <button
                        type="button"
                        onClick={() => setShowAddEmpInput(true)}
                        className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer flex items-center justify-center"
                        title="Cadastrar Novo Funcionário"
                      >
                        <Plus size={13} />
                      </button>
                    ) : (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-2 shadow-lg z-50 space-y-1.5">
                        <input
                          type="text"
                          placeholder="Novo funcionário..."
                          value={newSidebarEmpName}
                          onChange={(e) => setNewSidebarEmpName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                              if (!newSidebarEmpName.trim()) return;
                              try {
                                setEmpRegisterError(null);
                                await registerEmployee(newSidebarEmpName.trim());
                                await linkEmployee(newSidebarEmpName.trim());
                                setNewSidebarEmpName('');
                                setShowAddEmpInput(false);
                              } catch (err: any) {
                                setEmpRegisterError(err.message || 'Erro ao cadastrar.');
                              }
                            }
                          }}
                          className="w-full bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded px-1.5 py-1 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden"
                          autoFocus
                        />
                        {empRegisterError && (
                          <p className="text-[9px] text-red-500 font-semibold leading-tight">{empRegisterError}</p>
                        )}
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddEmpInput(false);
                              setNewSidebarEmpName('');
                              setEmpRegisterError(null);
                            }}
                            className="px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-gray-700 dark:text-gray-400 font-semibold cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!newSidebarEmpName.trim()) return;
                              try {
                                setEmpRegisterError(null);
                                await registerEmployee(newSidebarEmpName.trim());
                                await linkEmployee(newSidebarEmpName.trim());
                                setNewSidebarEmpName('');
                                setShowAddEmpInput(false);
                              } catch (err: any) {
                                setEmpRegisterError(err.message || 'Erro ao cadastrar.');
                              }
                            }}
                            className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-bold cursor-pointer transition-colors"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Info */}
            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-800 pl-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-7 h-7 rounded-full border border-gray-200 dark:border-gray-700" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-7 h-7 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center font-bold text-xs border border-gray-200 dark:border-gray-700 shrink-0">
                  {user.displayName ? user.displayName[0] : 'U'}
                </div>
              )}
              <div className="text-left hidden lg:block max-w-[120px] truncate">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate" title={user.displayName || ''}>
                  {user.displayName || 'Usuário'}
                </p>
                <p className="text-[9px] text-gray-500 truncate" title={user.email || ''}>
                  {user.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg cursor-pointer transition-colors ml-1"
                title="Sair da Conta"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area with optimized screen real estate to maximize vertical workspace */}
        <main className="flex-1 p-2.5 md:p-3.5 max-w-full w-full overflow-x-hidden">
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
    </div>
  );
}

function AuthForm() {
  const { login, register, loading, employees } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
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
      if (mode === 'register') {
        await register(email, password, name || undefined, employeeName || undefined);
      } else if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'reset') {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Erro ao redefinir senha.');
        }
        alert('Senha redefinida com sucesso! Entre usando sua nova senha.');
        setMode('login');
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
            setMode('login');
            setAuthError('');
          }}
          className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            mode === 'login'
              ? 'text-gray-900 dark:text-white border-b-2 border-gray-950 dark:border-white font-black'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          Entrar
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setAuthError('');
          }}
          className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            mode === 'register'
              ? 'text-gray-900 dark:text-white border-b-2 border-gray-950 dark:border-white font-black'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          Cadastrar
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('reset');
            setAuthError('');
          }}
          className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
            mode === 'reset'
              ? 'text-gray-900 dark:text-white border-b-2 border-gray-950 dark:border-white font-black'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          Redefinir
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {authError && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded border border-red-200/50 dark:border-red-900/50">
            {authError}
          </div>
        )}

        {mode === 'register' && (
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
            {mode === 'reset' ? 'Nova Senha' : 'Senha'}
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'reset' ? 'Digite a nova senha' : 'Digite sua senha'}
            required
            className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded px-3 py-2 text-xs focus:outline-hidden text-gray-900 dark:text-gray-100"
          />
        </div>

        {mode === 'register' && (
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
              {employees.map((emp) => (
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
            <span>{mode === 'register' ? 'Registrar e Entrar' : mode === 'reset' ? 'Redefinir Senha' : 'Entrar'}</span>
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
