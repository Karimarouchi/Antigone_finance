import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center p-10">
      <h1 className="text-5xl font-semibold tracking-tight">Antigone — Finace</h1>
      <p className="mt-4 opacity-70 max-w-md">
        Plateforme financière complète. Connectez-vous pour accéder à votre espace.
      </p>
      <div className="mt-8 flex gap-3">
        {session
          ? <Link to={ROUTES.app.dashboard} className="rounded-md bg-[#e8621a] text-white px-5 py-2">Tableau de bord</Link>
          : <>
              <Link to={ROUTES.login} className="rounded-md bg-[#e8621a] text-white px-5 py-2">Connexion</Link>
              <Link to={ROUTES.signup} className="rounded-md border border-foreground/20 px-5 py-2">Inscription</Link>
            </>}
      </div>
    </div>
  );
}
