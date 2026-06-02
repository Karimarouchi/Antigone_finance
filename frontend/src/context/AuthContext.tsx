import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  api, fetchMe, loadSession, login as apiLogin, logout as apiLogout,
  saveSession, signup as apiSignup, loginWithGoogle, type AuthSession,
} from '@/lib/api';

interface AuthState {
  loading: boolean;
  session: AuthSession | null;
  features: string[];
}
interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (req: { firstName: string; lastName: string; email: string; password: string; inviteCode: string }) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshFeatures: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasFeature: (id: string) => boolean;
  // Legacy compatibility shims (Supabase-era property names):
  user: AuthSession['user'] | null;
  profile: AuthSession['user'] | null;
  can: (id: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true, session: loadSession(), features: [],
  });

  const refreshFeatures = useCallback(async () => {
    const s = loadSession();
    if (!s) { setState((x) => ({ ...x, session: null, features: [], loading: false })); return; }
    try {
      const me = await fetchMe();
      setState({ loading: false, session: { ...s, user: me.user }, features: me.features });
      saveSession({ ...s, user: me.user });
    } catch {
      saveSession(null);
      setState({ loading: false, session: null, features: [] });
    }
  }, []);

  useEffect(() => {
    refreshFeatures();
    const onChange = () => setState((x) => ({ ...x, session: loadSession() }));
    window.addEventListener('finace:auth-change', onChange);
    return () => window.removeEventListener('finace:auth-change', onChange);
  }, [refreshFeatures]);

  // Realtime feature changes via WS would call refreshFeatures(); wire later in protected layout.

  const value = useMemo<AuthContextValue>(() => {
    const u = state.session?.user ?? null;
    const profile = u ? {
      ...u,
      full_name: u.full_name ?? u.fullName,
      avatar_url: u.avatar_url ?? u.avatarUrl,
    } : null;
    return {
      ...state,
      login: async (email, password) => { await apiLogin(email, password); await refreshFeatures(); },
      signup: async (req) => { await apiSignup(req); await refreshFeatures(); },
      loginWithGoogle: async (idToken) => { await loginWithGoogle(idToken); await refreshFeatures(); },
      logout: async () => { await apiLogout(); setState({ loading: false, session: null, features: [] }); },
      refreshFeatures,
      refreshProfile: refreshFeatures,
      hasFeature: (id) => state.features.includes(id),
      user: u,
      profile,
      can: (id) => state.features.includes(id),
    };
  }, [state, refreshFeatures]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Re-export api so existing source files importing it through the context work.
export { api };
