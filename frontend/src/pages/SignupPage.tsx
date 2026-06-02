import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';

export default function SignupPage() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', inviteCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await signup(form);
      nav(ROUTES.app.dashboard, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Inscription impossible.');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-8">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-medium">Créer un compte</h1>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="Prénom" required value={form.firstName} onChange={upd('firstName')}
            className="rounded-md border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-[#e8621a]" />
          <input placeholder="Nom" required value={form.lastName} onChange={upd('lastName')}
            className="rounded-md border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-[#e8621a]" />
        </div>
        <input type="email" placeholder="Email" required value={form.email} onChange={upd('email')}
          className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-[#e8621a]" />
        <input type="password" placeholder="Mot de passe (6+ caractères)" required minLength={6}
          value={form.password} onChange={upd('password')}
          className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-[#e8621a]" />
        <input placeholder="Code d'invitation" required value={form.inviteCode} onChange={upd('inviteCode')}
          className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 outline-none focus:border-[#e8621a]" />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button disabled={loading} type="submit"
          className="w-full rounded-md bg-[#e8621a] text-white py-2 font-medium disabled:opacity-60">
          {loading ? 'Création…' : "S'inscrire"}
        </button>

        <p className="text-sm opacity-70">
          Déjà un compte ?{' '}
          <Link to={ROUTES.login} className="text-[#e8621a] hover:underline">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
