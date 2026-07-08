import React, { createContext, useContext, useEffect, useState } from 'react';

export interface PostgresUser {
  id: number;
  uid: string;
  email: string;
  name: string | null;
  employeeName: string | null;
  createdAt: string;
}

// Keeping the interface type exactly the same for seamless compatibility across existing components
export interface CustomUser {
  uid: string;
  email: string;
  name: string | null;
}

interface AuthContextType {
  user: CustomUser | null;
  token: string | null;
  postgresUser: PostgresUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, passwordPlain: string, name?: string, employeeName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: (force?: boolean) => Promise<string | null>;
  fetchWithAuth: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  linkEmployee: (employeeName: string | null) => Promise<void>;
  employees: string[];
  fetchEmployees: () => Promise<void>;
  registerEmployee: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [postgresUser, setPostgresUser] = useState<PostgresUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<string[]>([]);

  const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const currentToken = token || localStorage.getItem('token');
    const headers = new Headers(init?.headers);
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
    return fetch(input, { ...init, headers });
  };

  const refreshToken = async () => {
    return token;
  };

  // On mount, load user profile if token is present
  useEffect(() => {
    const loadProfile = async () => {
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${currentToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            setUser({
              uid: data.uid,
              email: data.email,
              name: data.name,
            });
            setPostgresUser(data);
          } else {
            // Token is invalid/expired
            localStorage.removeItem('token');
            setToken(null);
            setUser(null);
            setPostgresUser(null);
          }
        } catch (err) {
          console.error('Error loading profile on mount:', err);
        }
      }
      setLoading(false);
    };

    loadProfile();
  }, [token]);

  const fetchEmployees = async () => {
    try {
      const response = await fetchWithAuth('/api/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const registerEmployee = async (name: string) => {
    try {
      const response = await fetchWithAuth('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao cadastrar funcionário.');
      }
      const data = await response.json();
      setEmployees(data);
    } catch (err: any) {
      console.error('Error registering employee:', err);
      throw err;
    }
  };

  useEffect(() => {
    if (token) {
      fetchEmployees();
    } else {
      setEmployees([]);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Credenciais inválidas.');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser({
        uid: data.user.uid,
        email: data.user.email,
        name: data.user.name,
      });
      setPostgresUser(data.user);
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, passwordPlain: string, name?: string, employeeName?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password: passwordPlain, name, employeeName }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao cadastrar usuário.');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser({
        uid: data.user.uid,
        email: data.user.email,
        name: data.user.name,
      });
      setPostgresUser(data.user);
    } catch (err) {
      console.error('Register error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setPostgresUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const linkEmployee = async (employeeName: string | null) => {
    try {
      const response = await fetchWithAuth('/api/auth/link-employee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employeeName }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Falha ao vincular funcionário.');
      }
      const updatedUser = await response.json();
      setPostgresUser(updatedUser);
    } catch (err: any) {
      console.error('Error linking employee:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, postgresUser, loading, login, register, logout, refreshToken, fetchWithAuth, linkEmployee, employees, fetchEmployees, registerEmployee }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
