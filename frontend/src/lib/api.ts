import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// ── Token storage ────────────────────────────────────────────────────────────
const STORAGE_KEY = 'finace:auth';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  accessTtlMinutes: number;
  user: {
    id: string;
    email: string;
    fullName: string | null;
    avatarUrl: string | null;
    role: string;
    // Legacy snake_case aliases for components ported from the Supabase project.
    full_name?: string | null;
    avatar_url?: string | null;
    [key: string]: unknown;
  };
}

export function loadSession(): AuthSession | null {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}
export function saveSession(s: AuthSession | null) {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else   localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('finace:auth-change'));
}

// ── Axios instance ───────────────────────────────────────────────────────────
const baseURL = (import.meta.env.VITE_API_URL as string) || '';

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: false,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const s = loadSession();
  if (s?.accessToken) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${s.accessToken}`;
  }
  return config;
});

// ── Refresh-on-401 (single-flight) ───────────────────────────────────────────
let refreshing: Promise<AuthSession | null> | null = null;

async function doRefresh(): Promise<AuthSession | null> {
  const s = loadSession();
  if (!s?.refreshToken) return null;
  try {
    const { data } = await axios.post(`${baseURL}/api/auth/refresh`,
        { refreshToken: s.refreshToken }, { headers: { 'Content-Type': 'application/json' } });
    const next: AuthSession = data;
    saveSession(next);
    return next;
  } catch {
    saveSession(null);
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const cfg = err.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (!cfg || cfg._retry) throw err;
    if (err.response?.status !== 401) throw err;

    // Don't try to refresh the refresh call itself.
    if (cfg.url?.includes('/api/auth/refresh')) throw err;

    cfg._retry = true;
    refreshing ??= doRefresh().finally(() => { refreshing = null; });
    const next = await refreshing;
    if (!next) throw err;
    (cfg.headers as any).Authorization = `Bearer ${next.accessToken}`;
    return api(cfg);
  },
);

// ── Helpers ──────────────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<AuthSession> {
  const { data } = await api.post<AuthSession>('/api/auth/login', { email, password });
  saveSession(data);
  return data;
}

export async function signup(req: {
  firstName: string; lastName: string; email: string; password: string; inviteCode: string;
}): Promise<AuthSession> {
  const { data } = await api.post<AuthSession>('/api/auth/signup', req);
  saveSession(data);
  return data;
}

export async function loginWithGoogle(idToken: string): Promise<AuthSession> {
  const { data } = await api.post<AuthSession>('/api/auth/google', { idToken });
  saveSession(data);
  return data;
}

export async function logout() {
  const s = loadSession();
  try {
    if (s?.refreshToken) await api.post('/api/auth/logout', { refreshToken: s.refreshToken });
  } catch { /* ignore */ }
  saveSession(null);
}

export async function fetchMe(): Promise<{
  user: AuthSession['user']; features: string[];
}> {
  const { data } = await api.get('/api/auth/me');
  return data;
}

export default api;
