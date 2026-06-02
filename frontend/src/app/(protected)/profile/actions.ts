// Compatibility shim for legacy server actions that lived under
// `app/(protected)/profile/actions.ts` in the Next.js source project.
import { api } from '@/lib/api';

// Convert snake_case keys to camelCase to match the Spring Boot API contract
function toCamel(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
      v,
    ])
  );
}

export async function updateProfile(payload: Record<string, unknown>): Promise<unknown> {
  const { data } = await api.patch('/api/profile', toCamel(payload));
  return data;
}

export const updateProfileInfo = updateProfile;
