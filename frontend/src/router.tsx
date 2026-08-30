import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { ProtectedRoute, PublicOnlyRoute, FeatureRoute } from '@/components/route-guards';
import { AuthLayout } from '@/components/AuthLayout';
import { ProtectedLayout } from '@/components/ProtectedLayout';

// Lazy-loaded pages. Files are scaffolded in src/pages — each module exports
// default React component. As you port pages from the source app/, drop them
// into src/pages/<section>/<page>.tsx and update the path below.
import { lazy, Suspense, type ComponentType } from 'react';
import ClientsPage from '@/pages/ClientsPage';
import ClientDetailPage from '@/pages/ClientDetailPage';
import ContactsPage from '@/pages/ContactsPage';

/** After a deploy, cached index.html can request old hashed chunks. Reload once. */
function lazyPage(importer: () => Promise<{ default: ComponentType }>) {
  return lazy(() =>
    importer().catch((err: unknown) => {
      const key = 'finace-chunk-reload';
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
        return new Promise<{ default: ComponentType }>(() => {});
      }
      throw err;
    }),
  );
}

const HomePage      = lazyPage(() => import('@/pages/HomePage'));
const LoginPage     = lazyPage(() => import('@/pages/LoginPage'));
const SignupPage    = lazyPage(() => import('@/pages/SignupPage'));
const DashboardPage = lazyPage(() => import('@/pages/DashboardPage'));
const ProfilePage   = lazyPage(() => import('@/pages/ProfilePage'));
const ApercuPage    = lazyPage(() => import('@/pages/ApercuPage'));
const ProjectsPage  = lazyPage(() => import('@/pages/ProjectsPage'));
const InvoicePage   = lazyPage(() => import('@/pages/InvoicePage'));
const AdminPage     = lazyPage(() => import('@/pages/AdminPage'));
const SuperAdminPage= lazyPage(() => import('@/pages/SuperAdminPage'));
const EncaissementsLayout       = lazyPage(() => import('@/features/encaissements/EncaissementsLayout'));
const EncaissementsOverview     = lazyPage(() => import('@/pages/encaissements/Overview'));
const EncaissementsFactures     = lazyPage(() => import('@/pages/encaissements/Factures'));
const EncaissementsAutres       = lazyPage(() => import('@/pages/encaissements/AutresRevenus'));
const DecaissementsLayout       = lazyPage(() => import('@/features/decaissements/DecaissementsLayout'));
const DecaissementsOverview     = lazyPage(() => import('@/pages/decaissements/Overview'));
const DecaissementsSalaires     = lazyPage(() => import('@/pages/decaissements/Salaires'));
const DecaissementsChargesFixes = lazyPage(() => import('@/pages/decaissements/ChargesFixes'));
const DecaissementsChargesVar   = lazyPage(() => import('@/pages/decaissements/ChargesVariables'));
const DecaissementsEtat         = lazyPage(() => import('@/pages/decaissements/Etat'));
const DecaissementsDettes       = lazyPage(() => import('@/pages/decaissements/Dettes'));

function ProtectedShell() {
  return <ProtectedLayout />;
}

const router = createBrowserRouter([
  // Public
  { path: ROUTES.home, element: (<Suspense><HomePage /></Suspense>) },

  // Auth (only when logged out)
  {
    element: <PublicOnlyRoute />,
    children: [{
      element: <AuthLayout />,
      children: [
        { path: ROUTES.login,  element: (<Suspense><LoginPage /></Suspense>) },
        { path: ROUTES.signup, element: (<Suspense><SignupPage /></Suspense>) },
      ],
    }],
  },

  // Protected
  {
    element: <ProtectedRoute />,
    children: [{
      element: <ProtectedShell />,
      children: [
        { path: ROUTES.app.dashboard, element: <DashboardPage /> },
        { path: ROUTES.app.profile,   element: <ProfilePage /> },
        {
          element: <FeatureRoute feature="apercu" />,
          children: [{ path: ROUTES.app.apercu, element: <ApercuPage /> }],
        },
        {
          element: <FeatureRoute feature="projects" />,
          children: [{ path: ROUTES.app.projects, element: <ProjectsPage /> }],
        },
        {
          element: <FeatureRoute feature={['clients', 'invoice', 'invoice-creator', 'contacts', 'payments', 'encaissements-factures']} />,
          children: [
            { path: ROUTES.app.clients,       element: <ClientsPage /> },
            { path: ROUTES.app.clientDetail,  element: <Suspense><ClientDetailPage /></Suspense> },
            { path: ROUTES.app.contacts,      element: <ContactsPage /> },
            { path: ROUTES.app.invoice,       element: <InvoicePage /> },
          ],
        },
        {
          element: <FeatureRoute feature={[
            'encaissements',
            'encaissements-overview',
            'encaissements-factures',
            'encaissements-autres-revenus',
          ]} />,
          children: [{
            element: <Suspense><EncaissementsLayout /></Suspense>,
            children: [
              { path: ROUTES.app.encaissements.overview,      element: <Suspense><EncaissementsOverview /></Suspense> },
              { path: ROUTES.app.encaissements.factures,      element: <Suspense><EncaissementsFactures /></Suspense> },
              { path: ROUTES.app.encaissements.autresRevenus, element: <Suspense><EncaissementsAutres /></Suspense> },
            ],
          }],
        },
        {
          element: <FeatureRoute feature={[
            'decaissements',
            'decaissements-overview',
            'decaissements-salaires',
            'decaissements-charges-fixes',
            'decaissements-charges-variables',
            'decaissements-etat',
            'decaissements-dettes',
          ]} />,
          children: [{
            element: <Suspense><DecaissementsLayout /></Suspense>,
            children: [
              { path: ROUTES.app.decaissements.overview,         element: <Suspense><DecaissementsOverview /></Suspense> },
              { path: ROUTES.app.decaissements.salaires,         element: <Suspense><DecaissementsSalaires /></Suspense> },
              { path: ROUTES.app.decaissements.chargesFixes,     element: <Suspense><DecaissementsChargesFixes /></Suspense> },
              { path: ROUTES.app.decaissements.chargesVariables, element: <Suspense><DecaissementsChargesVar /></Suspense> },
              { path: ROUTES.app.decaissements.etat,             element: <Suspense><DecaissementsEtat /></Suspense> },
              { path: ROUTES.app.decaissements.dettes,           element: <Suspense><DecaissementsDettes /></Suspense> },
            ],
          }],
        },
        {
          element: <FeatureRoute feature="admin" />,
          children: [{ path: ROUTES.app.admin, element: <AdminPage /> }],
        },
        {
          element: <FeatureRoute feature="super-admin" />,
          children: [{ path: ROUTES.app.superAdmin, element: <SuperAdminPage /> }],
        },
      ],
    }],
  },

  // Fallback
  { path: '*', element: <div className="p-8">Page introuvable</div> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
