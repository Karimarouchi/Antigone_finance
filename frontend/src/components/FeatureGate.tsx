/**
 * components/FeatureGate.tsx
 *
 * Client component that conditionally renders its children based on whether
 * the current user has been granted a feature.
 *
 * All variants read from AuthContext and never make extra network requests.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * API
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * <FeatureGate featureId="decaissements-salaires">
 *   <SalairesLink />
 * </FeatureGate>
 *
 * <FeatureGate featureId="invoice-creator" fallback={<UpgradePrompt />}>
 *   <InvoiceButton />
 * </FeatureGate>
 *
 * <FeatureGate
 *   featureId="clients"
 *   loadingFallback={<Skeleton />}
 *   fallback={<AccessDenied />}
 * >
 *   <ClientsPage />
 * </FeatureGate>
 *
 * // Invert: render only when NOT granted
 * <FeatureGate featureId="invoice-creator" invert>
 *   <UpgradePrompt />
 * </FeatureGate>
 */

import type { ReactNode } from 'react'
import { useFeature, useFeatures } from '@/hooks/useFeature'

// ── Single-feature gate ────────────────────────────────────────────────────────

interface FeatureGateProps {
  /** Feature id from config/features.ts */
  featureId: string
  children: ReactNode
  /** Rendered when access is denied (default: nothing) */
  fallback?: ReactNode
  /** Rendered while the session is loading (default: nothing) */
  loadingFallback?: ReactNode
  /**
   * When true, inverts the check: renders children when the feature is NOT
   * granted (e.g. for upgrade prompts).
   */
  invert?: boolean
}

export function FeatureGate({
  featureId,
  children,
  fallback       = null,
  loadingFallback = null,
  invert         = false,
}: FeatureGateProps) {
  const { granted, loading } = useFeature(featureId)

  if (loading)                       return <>{loadingFallback}</>
  if (invert ? granted : !granted)   return <>{fallback}</>
  return <>{children}</>
}

// ── Multi-feature gate (ALL required) ─────────────────────────────────────────

interface FeatureGateAllProps {
  /** All of these feature ids must be granted */
  featureIds: string[]
  children: ReactNode
  fallback?:        ReactNode
  loadingFallback?: ReactNode
}

/**
 * Renders children only when the user has ALL of the listed features.
 *
 * @example
 *   <FeatureGateAll featureIds={['decaissements-etat', 'decaissements-salaires']}>
 *     <AdminPanel />
 *   </FeatureGateAll>
 */
export function FeatureGateAll({
  featureIds,
  children,
  fallback        = null,
  loadingFallback = null,
}: FeatureGateAllProps) {
  const { hasAll, loading } = useFeatures(featureIds)

  if (loading) return <>{loadingFallback}</>
  if (!hasAll) return <>{fallback}</>
  return <>{children}</>
}

// ── Multi-feature gate (ANY sufficient) ───────────────────────────────────────

interface FeatureGateAnyProps {
  /** At least one of these feature ids must be granted */
  featureIds: string[]
  children: ReactNode
  fallback?:        ReactNode
  loadingFallback?: ReactNode
}

/**
 * Renders children when the user has ANY of the listed features.
 *
 * @example
 *   <FeatureGateAny featureIds={['encaissements-factures', 'encaissements-autres-revenus']}>
 *     <EncaissementsMenu />
 *   </FeatureGateAny>
 */
export function FeatureGateAny({
  featureIds,
  children,
  fallback        = null,
  loadingFallback = null,
}: FeatureGateAnyProps) {
  const { hasAny, loading } = useFeatures(featureIds)

  if (loading) return <>{loadingFallback}</>
  if (!hasAny) return <>{fallback}</>
  return <>{children}</>
}
