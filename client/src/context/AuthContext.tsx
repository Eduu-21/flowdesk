import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setSessionExpiredHandler, tokenStore } from '@/lib/api';
import type { User } from '@/types';
import { useToast } from './ToastContext';

type Status = 'loading' | 'authenticated' | 'anonymous' | 'error';

interface RegisterInput {
  name: string;
  studioName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface AuthContextValue {
  user: User | null;
  status: Status;
  error: unknown;
  isAdmin: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>(tokenStore.get() ? 'loading' : 'anonymous');
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const queryClient = useQueryClient();
  const toast = useToast();

  // Restore the session on first load
  useEffect(() => {
    if (!tokenStore.get()) {
      setStatus('anonymous');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    api
      .get<{ user: User }>('/auth/me')
      .then((res) => {
        if (cancelled) return;
        setUserState(res.user);
        setStatus('authenticated');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          tokenStore.clear();
          setStatus('anonymous');
        } else {
          // Server down or unexpected error: do not log the user out, show a retry screen.
          setError(err);
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Any API call that reports an expired session signs the user out gracefully
  useEffect(() => {
    setSessionExpiredHandler(() => {
      tokenStore.clear();
      queryClient.clear();
      setUserState(null);
      setStatus('anonymous');
      toast.error('Your session has expired. Please sign in again.');
    });
    return () => setSessionExpiredHandler(null);
  }, [queryClient, toast]);

  const finish = useCallback(
    (res: { token: string; user: User }, remember: boolean) => {
      queryClient.clear();
      tokenStore.set(res.token, remember);
      setUserState(res.user);
      setStatus('authenticated');
      return res.user;
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string, remember: boolean) =>
      finish(await api.post<{ token: string; user: User }>('/auth/login', { email, password, remember }), remember),
    [finish],
  );

  const register = useCallback(
    async (input: RegisterInput) => finish(await api.post<{ token: string; user: User }>('/auth/register', input), false),
    [finish],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* signing out locally is enough */
    }
    tokenStore.clear();
    queryClient.clear();
    setUserState(null);
    setStatus('anonymous');
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      error,
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      setUser: setUserState,
      retry: () => setAttempt((n) => n + 1),
    }),
    [user, status, error, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The signed-in user; only call inside protected routes. */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user;
}
