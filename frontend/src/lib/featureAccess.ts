/** Feature IDs granted in Admin vs IDs checked on routes / APIs. */

const GROUPS: Record<string, string[]> = {
  encaissements: [
    'encaissements',
    'encaissements-overview',
    'encaissements-factures',
    'encaissements-autres-revenus',
    'encaissements-autres',
  ],
  decaissements: [
    'decaissements',
    'decaissements-overview',
    'decaissements-salaires',
    'decaissements-charges-fixes',
    'decaissements-charges-variables',
    'decaissements-charges',
    'decaissements-etat',
    'decaissements-dettes',
    'decaissements-cnss',
  ],
  invoice: [
    'invoice',
    'invoice-creator',
    'clients',
    'contacts',
    'payments',
    'encaissements-factures',
  ],
};

function groupOf(id: string): string[] | undefined {
  if (GROUPS[id]) return GROUPS[id];
  for (const members of Object.values(GROUPS)) {
    if (members.includes(id)) return members;
  }
  return undefined;
}

export function hasFeatureAccess(granted: string[], required: string, role?: string | null): boolean {
  if (role === 'super_admin') return true;
  if (role === 'admin' && required === 'admin') return true;
  if (granted.includes(required)) return true;
  const cluster = groupOf(required);
  if (!cluster) return false;
  return cluster.some((id) => granted.includes(id));
}
