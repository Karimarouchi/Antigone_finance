// Compatibility shim for legacy code that used Next.js server actions
// from `@/lib/auth-actions`. The Spring Boot version performs auth via
// the typed API in `@/lib/api`.
import { logout as apiLogout } from './api';

export interface SignOutResult { redirectTo: string }

export async function signOutAction(): Promise<SignOutResult> {
  await apiLogout();
  return { redirectTo: '/login' };
}

export const signOut = signOutAction;
export const logout = signOutAction;
