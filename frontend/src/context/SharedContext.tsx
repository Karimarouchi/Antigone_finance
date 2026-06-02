import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import type { ReactNode, Dispatch } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';

/**
 * SharedContext — combines:
 *  1. Theme + privacy reducer (legacy `state` / `dispatch`, used by useTheme, usePrivacy, GlowCard, etc.).
 *  2. Data cache for clients / contacts / payments (new `reloadAll` API).
 */
interface ThemeState {
  theme: 'light' | 'dark';
  privacyMode: boolean;
}
type ThemeAction =
  | { type: 'SET_THEME'; value: 'light' | 'dark' }
  | { type: 'SET_PRIVACY'; value: boolean };

const defaultTheme: ThemeState = { theme: 'light', privacyMode: false };

function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case 'SET_THEME': return { ...state, theme: action.value };
    case 'SET_PRIVACY': return { ...state, privacyMode: action.value };
    default: return state;
  }
}

function initialTheme(): ThemeState {
  if (typeof window === 'undefined') return defaultTheme;
  const saved = localStorage.getItem('theme');
  return { theme: (saved === 'dark' ? 'dark' : 'light'), privacyMode: false };
}

interface DataState {
  clients: any[];
  contacts: any[];
  payments: any[];
  loaded: { clients: boolean; contacts: boolean; payments: boolean };
}
const emptyData: DataState = {
  clients: [], contacts: [], payments: [],
  loaded: { clients: false, contacts: false, payments: false },
};

interface SharedContextValue extends DataState {
  state: ThemeState;
  dispatch: Dispatch<ThemeAction>;
  reloadClients: () => Promise<void>;
  reloadContacts: () => Promise<void>;
  reloadPayments: () => Promise<void>;
  reloadAll: () => Promise<void>;
}

const SharedContext = createContext<SharedContextValue | null>(null);

export function SharedProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [data, setData] = useState<DataState>(emptyData);
  const [state, dispatch] = useReducer(themeReducer, defaultTheme, initialTheme);

  useEffect(() => {
    document.body.classList.toggle('dark', state.theme === 'dark');
    try { localStorage.setItem('theme', state.theme); } catch { /* noop */ }
  }, [state.theme]);

  const reloadClients = useCallback(async () => {
    try { const { data } = await api.get('/api/clients'); setData((s) => ({ ...s, clients: data, loaded: { ...s.loaded, clients: true } })); }
    catch { /* ignore */ }
  }, []);
  const reloadContacts = useCallback(async () => {
    try { const { data } = await api.get('/api/contacts'); setData((s) => ({ ...s, contacts: data, loaded: { ...s.loaded, contacts: true } })); }
    catch { /* ignore */ }
  }, []);
  const reloadPayments = useCallback(async () => {
    try { const { data } = await api.get('/api/payments'); setData((s) => ({ ...s, payments: data, loaded: { ...s.loaded, payments: true } })); }
    catch { /* ignore */ }
  }, []);
  const reloadAll = useCallback(async () => {
    await Promise.all([reloadClients(), reloadContacts(), reloadPayments()]);
  }, [reloadClients, reloadContacts, reloadPayments]);

  useEffect(() => {
    if (!session) { setData(emptyData); return; }
    reloadAll();
  }, [session, reloadAll]);

  const value = useMemo<SharedContextValue>(() => ({
    ...data,
    state, dispatch,
    reloadClients, reloadContacts, reloadPayments, reloadAll,
  }), [data, state, reloadClients, reloadContacts, reloadPayments, reloadAll]);

  return <SharedContext.Provider value={value}>{children}</SharedContext.Provider>;
}

export function useShared(): SharedContextValue {
  const ctx = useContext(SharedContext);
  if (!ctx) throw new Error('useShared must be used inside <SharedProvider>');
  return ctx;
}
