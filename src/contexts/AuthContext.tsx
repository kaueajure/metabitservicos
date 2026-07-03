import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onIdTokenChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

export interface PostgresUser {
  id: number;
  uid: string;
  email: string;
  name: string | null;
  employeeName: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  postgresUser: PostgresUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: (force?: boolean) => Promise<string | null>;
  fetchWithAuth: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  linkEmployee: (employeeName: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [postgresUser, setPostgresUser] = useState<PostgresUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Manual token refresh function
  const refreshToken = async (force = false) => {
    if (!auth.currentUser) return null;
    try {
      const freshToken = await auth.currentUser.getIdToken(force);
      setToken(freshToken);
      return freshToken;
    } catch (err) {
      console.error('Error refreshing token:', err);
      return null;
    }
  };

  // fetchWithAuth automatically handles appending authorization headers and retrying once upon a 401 error
  const fetchWithAuth = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let currentToken = token;
    if (!currentToken && auth.currentUser) {
      currentToken = await auth.currentUser.getIdToken();
    }

    const headers = new Headers(init?.headers);
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    let response = await fetch(input, { ...init, headers });

    if (response.status === 401 && auth.currentUser) {
      console.warn('API returned 401. Attempting token force refresh and retry...');
      const freshToken = await refreshToken(true);
      if (freshToken) {
        const retryHeaders = new Headers(init?.headers);
        retryHeaders.set('Authorization', `Bearer ${freshToken}`);
        response = await fetch(input, { ...init, headers: retryHeaders });
      }
    }

    return response;
  };

  useEffect(() => {
    // onIdTokenChanged triggers on sign-in, sign-out, and auto background token refreshes by the Firebase SDK
    const unsubscribe = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);

          // Synchronize user with Postgres database
          const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ name: currentUser.displayName }),
          });
          if (response.ok) {
            const dbUser = await response.json();
            setPostgresUser(dbUser);
          }
        } catch (err) {
          console.error('Error syncing auth token or user:', err);
        }
      } else {
        setUser(null);
        setToken(null);
        setPostgresUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Periodic refresher to prevent expiration (runs every 10 minutes if user is signed in)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        console.log('Background refreshing ID token...');
        await refreshToken(false); // getCached or fresh if expired
      } catch (err) {
        console.error('Background token refresh failed:', err);
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => clearInterval(interval);
  }, [user]);

  // Window focus listener to refresh the token after sleep/wake or tab backgrounding
  useEffect(() => {
    const handleFocus = async () => {
      if (auth.currentUser) {
        console.log('Window focused, checking and refreshing ID token...');
        await refreshToken(false);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error('Login error:', err);
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
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
    <AuthContext.Provider value={{ user, token, postgresUser, loading, loginWithGoogle, logout, refreshToken, fetchWithAuth, linkEmployee }}>
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
