import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { ProtectedRoute, PublicOnlyRoute, FeatureRoute } from '@/components/route-guards';
import { AuthLayout } from '@/components/AuthLayout';
import { ProtectedLayout } from '@/components/ProtectedLayout';

// Lazy-loaded pages. Files are scaffolded in src/pages — each module exports
// default React component. As you port pages from the source app/, drop them
// into src/pages/<section>/<page>.tsx and update the path below.
import { lazy, Suspense } from 'react';
const HomePage      = lazy(() => import('@/pages/HomePage'));
const LoginPage     = lazy(() => import('@/pages/LoginPage'));
const SignupPage    = lazy(() => import('@/pages/SignupPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProfilePage   = lazy(() => import('@/pages/ProfilePage'));
const ClientsPage   = lazy(() => import('@/pages/ClientsPage'));
const ApercuPage    = lazy(() => import('@/pages/ApercuPage'));
const ContactsPage  = lazy(() => import('@/pages/ContactsPage'));
const ProjectsPage  = lazy(() => import('@/pages/ProjectsPage'));
const InvoicePage   = lazy(() => import('@/pages/InvoicePage'));
const AdminPage     = lazy(() => import('@/pages/AdminPage'));
const SuperAdminPage= lazy(() => import('@/pages/SuperAdminPage'));
const ClientDetailPage = lazy(() => import('@/pages/ClientDetailPage'));
const EncaissementsLayout       = lazy(() => import('@/features/encaissements/EncaissementsLayout'));
const EncaissementsOverview     = lazy(() => import('@/pages/encaissements/Overview'));
const EncaissementsFactures     = lazy(() => import('@/pages/encaissements/Factures'));
const EncaissementsAutres       = lazy(() => import('@/pages/encaissements/AutresRevenus'));
const DecaissementsLayout       = lazy(() => import('@/features/decaissements/DecaissementsLayout'));
const DecaissementsOverview     = lazy(() => import('@/pages/decaissements/Overview'));
const DecaissementsSalaires     = lazy(() => import('@/pages/decaissements/Salaires'));
const DecaissementsChargesFixes = lazy(() => import('@/pages/decaissements/ChargesFixes'));
const DecaissementsChargesVar   = lazy(() => import('@/pages/decaissements/ChargesVariables'));
const DecaissementsEtat         = lazy(() => import('@/pages/decaissements/Etat'));
const DecaissementsDettes       = lazy(() => import('@/pages/decaissements/Dettes'));

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
        { path: ROUTES.app.apercu,    element: <ApercuPage /> },
        { path: ROUTES.app.projects,  element: <ProjectsPage /> },
        {
          element: <FeatureRoute feature={['invoice', 'contacts', 'payments']} />,
          children: [
            { path: ROUTES.app.clients,       element: <ClientsPage /> },
            { path: ROUTES.app.clientDetail,  element: <Suspense><ClientDetailPage /></Suspense> },
            { path: ROUTES.app.contacts,      element: <ContactsPage /> },
            { path: ROUTES.app.invoice,       element: <InvoicePage /> },
          ],
        },
        {
          element: <FeatureRoute feature="encaissements" />,
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
          element: <FeatureRoute feature="decaissements" />,
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
        { path: ROUTES.app.admin,      element: <AdminPage /> },
        { path: ROUTES.app.superAdmin, element: <SuperAdminPage /> },
      ],
    }],
  },

  // Fallback
  { path: '*', element: <div className="p-8">Page introuvable</div> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
