/**
 * hooks/useFeature.ts — client hook reading feature grants from AuthContext.
 *
 *   const { granted, loading } = useFeature('decaissements-salaires')
 *   const { granted, hasAny }   = useFeatures(['clients', 'invoice'])
 */
import { useAuth } from '@/context/AuthContext';

interface UseFeatureResult { granted: boolean; loading: boolean; }

export function useFeature(featureId: string): UseFeatureResult {
  const { hasFeature, loading } = useAuth();
  return { granted: hasFeature(featureId), loading };
}

interface UseFeaturesResult {
  granted: Record<string, boolean>;
  hasAny: boolean;
  hasAll: boolean;
  loading: boolean;
}

export function useFeatures(featureIds: string[]): UseFeaturesResult {
  const { hasFeature, loading } = useAuth();
  const granted = Object.fromEntries(featureIds.map((id) => [id, hasFeature(id)]));
  const hasAny  = featureIds.some((id)  => granted[id]);
  const hasAll  = featureIds.every((id) => granted[id]);
  return { granted, hasAny, hasAll, loading };
}
