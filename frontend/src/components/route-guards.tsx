import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';

export function ProtectedRoute() {
  const { loading, session } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="p-8 text-sm opacity-60">Chargement…</div>;
  if (!session) return <Navigate to={ROUTES.login} state={{ from: loc.pathname }} replace />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { loading, session } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to={ROUTES.app.dashboard} replace />;
  return <Outlet />;
}

export function FeatureRoute({ feature }: { feature: string | string[] }) {
  const { hasFeature, features } = useAuth();
  const needed = Array.isArray(feature) ? feature : [feature];
  const ok = needed.some((f) => hasFeature(f));
  if (!ok) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-medium">Accès refusé</h2>
        <p className="opacity-60 text-sm mt-1">
          Cette fonctionnalité n'est pas activée pour votre compte.
        </p>
        <pre className="mt-3 text-xs opacity-50">requis: {needed.join(' | ')} — actuel: {features.join(', ') || '∅'}</pre>
      </div>
    );
  }
  return <Outlet />;
}
