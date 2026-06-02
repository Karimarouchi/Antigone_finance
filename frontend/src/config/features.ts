/**
 * config/features.ts
 *
 * Central feature registry — single source of truth for:
 *   • App routes
 *   • Sidebar / navbar visibility and ordering
 *   • Role-based permissions
 *
 * No UI code lives here. Components consume this registry to build
 * navigation and enforce access control.
 */

import { ROUTES } from '@/config/routes'

// ── Role & Permission types ────────────────────────────────────────────────────

/** All user roles in the application */
export type Role = 'super_admin' | 'admin' | 'manager' | 'viewer'

/** Granular actions that can be granted per feature */
export type Permission = 'view' | 'create' | 'edit' | 'delete'

/** Map of role → granted permissions for a single feature */
export type PermissionMap = Partial<Record<Role, Permission[]>>

// ── Feature types ──────────────────────────────────────────────────────────────

export interface Feature {
  /** Stable machine identifier — never rename this; used for permission checks */
  id: string
  /** Human-readable name shown in the UI */
  label: string
  /** App Router href (must start with /) */
  href: string
  /**
   * Lucide icon name (string).
   * Resolve to the actual component in the UI layer, e.g.:
   *   import { icons } from 'lucide-react'
   *   const Icon = icons[feature.icon]
   */
  icon: string
  /** Short description — used in dropdown menus and tooltips */
  description?: string
  /**
   * Use exact href comparison for active-route detection.
   * Needed for '/' so that '/decaissements' doesn't also mark '/' as active.
   */
  exactMatch?: boolean
  /** Show in sidebar / navbar. false = route exists but is not listed in nav */
  inNav: boolean
  /** Role → permission map. A role absent from this map has no access. */
  permissions: PermissionMap
  /** Optional display metadata */
  meta?: {
    /** Render as a CTA button rather than a plain link */
    cta?: boolean
    /** Informational badge text, e.g. 'new' | 'beta' | 'soon' */
    badge?: string
    /** Grey-out the nav entry (route may still be accessible via URL) */
    disabled?: boolean
  }
}

/**
 * A group of related features rendered as a dropdown in the navbar.
 * In a sidebar it would be an expandable section.
 */
export interface FeatureGroup {
  /** Stable machine identifier */
  id: string
  /** Display label for the dropdown trigger / section header */
  label: string
  /** Lucide icon name for the group trigger */
  icon: string
  /** Position in the top-level nav — lower number = further left / higher up */
  navOrder: number
  /** All features belonging to this group (including non-nav ones) */
  features: Feature[]
}

/**
 * A top-level nav item that does not belong to any group
 * (e.g. Home, Clients, the invoice CTA button).
 */
export interface StandaloneNavItem {
  /** Stable machine identifier */
  id: string
  /** Display label */
  label: string
  /** App Router href */
  href: string
  /** Lucide icon name */
  icon: string
  /** Position in the top-level nav */
  navOrder: number
  exactMatch?: boolean
  /** Show in navbar / sidebar */
  inNav: boolean
  /** Role → permission map */
  permissions: PermissionMap
  meta?: Feature['meta']
}

/** The complete application registry */
export interface AppRegistry {
  /** Items that appear at the top level without a dropdown */
  standalone: StandaloneNavItem[]
  /** Grouped items that expand into dropdowns / sections */
  groups: FeatureGroup[]
}

// ── Reusable permission presets ────────────────────────────────────────────────

const ALL: Permission[] = ['view', 'create', 'edit', 'delete']
const VIEW: Permission[] = ['view']

/** Every role gets full CRUD */
const fullAccess: PermissionMap = {
  admin:   ALL,
  manager: ALL,
  viewer:  VIEW,
}

/** Viewers are read-only; managers cannot create */
const managedAccess: PermissionMap = {
  admin:   ALL,
  manager: ['view', 'edit'],
  viewer:  VIEW,
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const APP_REGISTRY: AppRegistry = {

  // ── Standalone top-level nav items ──────────────────────────────────────────
  standalone: [
    {
      id:          'home',
      label:       'Accueil',
      href:        ROUTES.app.dashboard,
      icon:        'House',
      navOrder:    0,
      exactMatch:  true,
      inNav:       true,
      permissions: fullAccess,
    },
    {
      id:          'clients',
      label:       'Clients',
      href:        ROUTES.app.clients,
      icon:        'Users',
      navOrder:    1,
      inNav:       true,
      permissions: fullAccess,
    },
    {
      id:          'apercu',
      label:       'Aperçu',
      href:        ROUTES.app.apercu,
      icon:        'BarChart2',
      navOrder:    2,
      inNav:       true,
      permissions: fullAccess,
    },
    {
      id:          'contacts',
      label:       'Contacts',
      href:        ROUTES.app.contacts,
      icon:        'Contact',
      navOrder:    2,
      inNav:       false,         // accessible by URL but not shown in the main navbar
      permissions: fullAccess,
    },
    {
      id:          'projects',
      label:       'Projets',
      href:        ROUTES.app.projects,
      icon:        'FolderKanban',
      navOrder:    3,
      inNav:       false,         // accessible by URL but not shown in the main navbar
      permissions: fullAccess,
    },
    {
      id:          'invoice-creator',
      label:       'Créateur de Factures',
      href:        ROUTES.app.invoice,
      icon:        'FileText',
      navOrder:    10,            // rendered last (CTA button on the right)
      inNav:       true,
      permissions: managedAccess,
      meta:        { cta: true },
    },
    {
      id:          'admin',
      label:       'Administration',
      href:        ROUTES.app.admin,
      icon:        'ShieldCheck',
      navOrder:    99,
      inNav:       false,
      permissions: { admin: ALL },
    },
    {
      id:          'super-admin',
      label:       'Super Administration',
      href:        ROUTES.app.superAdmin,
      icon:        'ShieldAlert',
      navOrder:    100,
      inNav:       false,         // role-gated via profiles.role, not user_features
      permissions: { super_admin: ALL },
    },
  ],

  // ── Feature groups (rendered as dropdowns in the navbar) ────────────────────
  groups: [
    {
      id:       'encaissements',
      label:    'Encaissements',
      icon:     'TrendingUp',
      navOrder: 4,
      features: [
        {
          id:          'encaissements-overview',
          label:       "Vue d'ensemble",
          href:        ROUTES.app.encaissements.overview,
          icon:        'LayoutDashboard',
          description: "Synthèse globale des encaissements",
          inNav:       true,
          permissions: fullAccess,
        },
        {
          id:          'encaissements-factures',
          label:       'Factures',
          href:        ROUTES.app.encaissements.factures,
          icon:        'FileText',
          description: 'Gérez vos factures clients',
          inNav:       true,
          permissions: fullAccess,
        },
        {
          id:          'encaissements-autres-revenus',
          label:       'Autres revenus',
          href:        ROUTES.app.encaissements.autresRevenus,
          icon:        'PiggyBank',
          description: 'Revenus hors facturation',
          inNav:       true,
          permissions: fullAccess,
        },
      ],
    },

    {
      id:       'decaissements',
      label:    'Décaissements',
      icon:     'TrendingDown',
      navOrder: 5,
      features: [
        {
          id:          'decaissements-overview',
          label:       "Vue d'ensemble",
          href:        ROUTES.app.decaissements.overview,
          icon:        'LayoutDashboard',
          description: 'Aperçu global des décaissements',
          exactMatch:  true,
          inNav:       true,
          permissions: fullAccess,
        },
        {
          id:          'decaissements-salaires',
          label:       'Salaires',
          href:        ROUTES.app.decaissements.salaires,
          icon:        'Wallet',
          description: 'Gestion de la paie mensuelle',
          inNav:       true,
          permissions: managedAccess,
        },
        {
          id:          'decaissements-charges-fixes',
          label:       'Charges fixes',
          href:        ROUTES.app.decaissements.chargesFixes,
          icon:        'Building2',
          description: 'Loyer, abonnements, assurances…',
          inNav:       true,
          permissions: fullAccess,
        },
        {
          id:          'decaissements-charges-variables',
          label:       'Charges variables',
          href:        ROUTES.app.decaissements.chargesVariables,
          icon:        'BarChart2',
          description: 'Dépenses variables du mois',
          inNav:       true,
          permissions: fullAccess,
        },
        {
          id:          'decaissements-etat',
          label:       'État (Taxes)',
          href:        ROUTES.app.decaissements.etat,
          icon:        'Landmark',
          description: 'CNSS, TVA et obligations fiscales',
          inNav:       true,
          permissions: managedAccess,
        },
        {
          id:          'decaissements-dettes',
          label:       'Dettes',
          href:        ROUTES.app.decaissements.dettes,
          icon:        'CreditCard',
          description: 'Suivi des remboursements',
          inNav:       true,
          permissions: fullAccess,
        },
      ],
    },
  ],
}

// ── Derived helpers ────────────────────────────────────────────────────────────

/** Flat list of every Feature across all groups */
export const ALL_FEATURES: Feature[] = APP_REGISTRY.groups.flatMap((g) => g.features)

/** Look up a Feature by its id */
export function getFeature(id: string): Feature | undefined {
  return ALL_FEATURES.find((f) => f.id === id)
}

/** Look up a StandaloneNavItem by its id */
export function getStandaloneItem(id: string): StandaloneNavItem | undefined {
  return APP_REGISTRY.standalone.find((s) => s.id === id)
}

/** All nav-visible features inside a group */
export function getGroupNavFeatures(groupId: string): Feature[] {
  const group = APP_REGISTRY.groups.find((g) => g.id === groupId)
  return group?.features.filter((f) => f.inNav) ?? []
}

/**
 * Check whether a role has a specific permission on a feature.
 *
 * @example
 *   hasPermission('decaissements-salaires', 'viewer', 'create') // false
 *   hasPermission('decaissements-salaires', 'admin',  'delete') // true
 */
export function hasPermission(
  featureId: string,
  role: Role,
  permission: Permission,
): boolean {
  const feature = getFeature(featureId)
  if (!feature) return false
  return feature.permissions[role]?.includes(permission) ?? false
}

/**
 * All top-level nav items (standalone + group triggers) sorted by navOrder.
 * Use this to build the navbar or sidebar top-level structure.
 */
export function getSortedNavItems(): Array<
  (StandaloneNavItem & { type: 'standalone' }) |
  (FeatureGroup      & { type: 'group' })
> {
  const items = [
    ...APP_REGISTRY.standalone.filter((s) => s.inNav).map((s) => ({ ...s, type: 'standalone' as const })),
    ...APP_REGISTRY.groups.map((g) => ({ ...g, type: 'group' as const })),
  ]
  return items.sort((a, b) => a.navOrder - b.navOrder)
}
