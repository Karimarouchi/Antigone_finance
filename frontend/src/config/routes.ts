/**
 * config/routes.ts
 *
 * Single source of truth for all application routes.
 * Import ROUTES everywhere instead of hardcoding path strings.
 */

export const ROUTES = {
  // ── Public ──────────────────────────────────────────────────────────────────
  home:   '/',
  login:  '/login',
  signup: '/signup',

  // ── App (authenticated, served from the (protected) route group) ────────────
  app: {
    dashboard:  '/dashboard',
profile:    '/profile',
    clients:    '/about',
    clientDetail: '/about/:id',
    apercu:     '/apercu',
    contacts:   '/contacts',
    projects:   '/projects',
    invoice:    '/invoice',
    admin:      '/admin',
    superAdmin: '/super-admin',

    encaissements: {
      overview:      '/encaissements',
      factures:      '/encaissements/factures',
      autresRevenus: '/encaissements/autres-revenus',
    },

    decaissements: {
      overview:         '/decaissements',
      salaires:         '/decaissements/salaires',
      chargesFixes:     '/decaissements/charges-fixes',
      chargesVariables: '/decaissements/charges-variables',
      etat:             '/decaissements/etat',
      dettes:           '/decaissements/dettes',
    },
  },
} as const
