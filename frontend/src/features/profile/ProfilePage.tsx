import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import './profile.css';

/* ── Preset avatars ── */

const PRESET_AVATARS = [
  '/Avatars/Avatar 1.jpg',
  '/Avatars/Avatar 2.jpg',
  '/Avatars/Avatar 3.jpg',
  '/Avatars/Avatar 4.jpg',
  '/Avatars/Avatar 5.jpg',
  '/Avatars/Avatar 6.jpg',
];

/* ── Icons ── */

const EyeIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
);

/* ── Helpers ── */

function initials(name: string | null, email: string) {
  return name?.trim()
    ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : email[0].toUpperCase();
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { label: '8 car. min.', pass: password.length >= 8 },
    { label: 'Majuscule',   pass: /[A-Z]/.test(password) },
    { label: 'Chiffre',     pass: /\d/.test(password) },
    { label: 'Spécial',     pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const color = score <= 1 ? '#ff3b30' : score === 2 ? '#f97316' : score === 3 ? '#eab308' : '#16a34a';

  return (
    <div className="profile-strength">
      <div className="profile-strength-bars">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="profile-strength-bar" style={{ background: i < score ? color : undefined }} />
        ))}
      </div>
      <div className="profile-strength-checks">
        {checks.map((c) => (
          <span key={c.label} className={`profile-strength-check${c.pass ? ' pass' : ''}`}>
            {c.pass ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Avatar Card ── */

function AvatarCard() {
  const { user, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<string | null>(user?.avatarUrl ?? user?.avatar_url ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handlePick(url: string) {
    if (pending) return;
    const next = selected === url ? null : url;
    setSelected(next);
    setError(null);
    setSuccess(false);
    setPending(true);
    try {
      await api.patch('/api/profile', { avatarUrl: next });
      setSuccess(true);
      await refreshProfile();
    } catch {
      setError('Erreur lors de la mise à jour de l\'avatar.');
    } finally {
      setPending(false);
    }
  }

  const userEmail = user?.email ?? '';
  const fullName = user?.fullName ?? user?.full_name ?? null;

  return (
    <div className="profile-card">
      <p className="profile-card-title">Photo de profil</p>

      <div className="profile-avatar-wrap">
        <div className="profile-avatar-display">
          {selected
            ? <img src={selected} alt="Avatar sélectionné" />
            : <span className="profile-avatar-initials">{initials(fullName, userEmail)}</span>
          }
        </div>
        <p className="profile-avatar-name">{fullName ?? '—'}</p>
        <p className="profile-avatar-email">{userEmail}</p>
      </div>

      <div>
        <p className="profile-label" style={{ marginBottom: '0.6rem' }}>Choisir un avatar</p>
        <div className="profile-avatar-grid">
          {PRESET_AVATARS.map((src) => (
            <button
              key={src}
              type="button"
              className={`profile-avatar-option${selected === src ? ' selected' : ''}`}
              onClick={() => handlePick(src)}
              disabled={pending}
              aria-label={`Sélectionner ${src}`}
            >
              <img src={src} alt="" />
              {selected === src && (
                <span className="profile-avatar-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="profile-status-err">{error}</p>}
      {success && <p className="profile-status-ok">Avatar mis à jour.</p>}
    </div>
  );
}

/* ── Info Card ── */

function InfoCard() {
  const { user, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.fullName ?? user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [pending, setPending] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ error?: string; ok?: boolean } | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ error?: string; message?: string } | null>(null);

  const userEmail = user?.email ?? '';

  async function saveName(e: React.FormEvent) {
    e.preventDefault(); setNameMsg(null);
    setPending(true);
    try {
      await api.patch('/api/profile', { fullName: name });
      setNameMsg({ ok: true });
      await refreshProfile();
    } catch {
      setNameMsg({ error: 'Erreur lors de la mise à jour.' });
    } finally {
      setPending(false);
    }
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault(); setEmailMsg(null);
    setPending(true);
    try {
      await api.patch('/api/profile', { email });
      setEmailMsg({ message: 'Email mis à jour.' });
      await refreshProfile();
    } catch {
      setEmailMsg({ error: 'Erreur lors de la mise à jour de l\'email.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="profile-card">
      <p className="profile-card-title">Informations personnelles</p>

      <form onSubmit={saveName}>
        <div className="profile-row">
          <div className="profile-field">
            <label className="profile-label">Nom complet</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameMsg(null); }}
              placeholder="Votre nom"
              className="profile-input"
            />
          </div>
          <button
            type="submit"
            className="profile-btn-primary"
            disabled={pending || name === (user?.fullName ?? user?.full_name ?? '')}
          >
            {pending ? '…' : 'Sauvegarder'}
          </button>
        </div>
        {nameMsg?.error && <p className="profile-status-err" style={{ marginTop: '0.35rem' }}>{nameMsg.error}</p>}
        {nameMsg?.ok   && <p className="profile-status-ok"  style={{ marginTop: '0.35rem' }}>Nom mis à jour.</p>}
      </form>

      <div className="profile-divider" />

      <form onSubmit={saveEmail}>
        <div className="profile-row">
          <div className="profile-field">
            <label className="profile-label">Adresse email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailMsg(null); }}
              placeholder="votre@email.com"
              className="profile-input"
            />
          </div>
          <button
            type="submit"
            className="profile-btn-primary"
            disabled={pending || email === userEmail}
          >
            {pending ? '…' : 'Modifier'}
          </button>
        </div>
        {emailMsg?.error   && <p className="profile-status-err" style={{ marginTop: '0.35rem' }}>{emailMsg.error}</p>}
        {emailMsg?.message && <p className="profile-status-ok"  style={{ marginTop: '0.35rem' }}>{emailMsg.message}</p>}
        <p className="profile-hint" style={{ marginTop: '0.35rem' }}>
          Un lien de confirmation sera envoyé à la nouvelle adresse.
        </p>
      </form>
    </div>
  );
}

/* ── Password Card ── */

function PasswordCard() {
  const [current, setCurrent]  = useState('');
  const [pwd, setPwd]          = useState('');
  const [confirm, setConfirm]  = useState('');
  const [showCur, setShowCur]  = useState(false);
  const [showNew, setShowNew]  = useState(false);
  const [showCon, setShowCon]  = useState(false);
  const [pending, setPending]  = useState(false);
  const [msg, setMsg]          = useState<{ error?: string; message?: string } | null>(null);

  const mismatch = confirm.length > 0 && pwd !== confirm;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (pwd.length < 8) { setMsg({ error: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' }); return; }
    if (pwd !== confirm) { setMsg({ error: 'Les mots de passe ne correspondent pas.' }); return; }
    setPending(true);
    try {
      await api.post('/api/profile/password', { currentPassword: current, newPassword: pwd });
      setMsg({ message: 'Mot de passe mis à jour avec succès.' });
      setCurrent(''); setPwd(''); setConfirm('');
    } catch {
      setMsg({ error: 'Erreur — vérifiez votre mot de passe actuel.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="profile-card">
      <p className="profile-card-title">Changer le mot de passe</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div className="profile-field">
          <label className="profile-label">Mot de passe actuel</label>
          <div className="profile-input-wrap">
            <input
              type={showCur ? 'text' : 'password'}
              value={current}
              onChange={(e) => { setCurrent(e.target.value); setMsg(null); }}
              placeholder="Mot de passe actuel"
              autoComplete="current-password"
              required
              className="profile-input"
            />
            <button type="button" className="profile-input-eye" onClick={() => setShowCur((v) => !v)}>
              {showCur ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        <div className="profile-pwd-pair">
          <div className="profile-field">
            <label className="profile-label">Nouveau mot de passe</label>
            <div className="profile-input-wrap">
              <input
                type={showNew ? 'text' : 'password'}
                value={pwd}
                onChange={(e) => { setPwd(e.target.value); setMsg(null); }}
                placeholder="8 caractères min."
                autoComplete="new-password"
                required
                className="profile-input"
              />
              <button type="button" className="profile-input-eye" onClick={() => setShowNew((v) => !v)}>
                {showNew ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="profile-field">
            <label className="profile-label">Confirmer le nouveau</label>
            <div className="profile-input-wrap">
              <input
                type={showCon ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setMsg(null); }}
                placeholder="Répétez le mot de passe"
                autoComplete="new-password"
                required
                className={`profile-input${mismatch ? ' profile-input--error' : ''}`}
              />
              <button type="button" className="profile-input-eye" onClick={() => setShowCon((v) => !v)}>
                {showCon ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {mismatch && <p className="profile-status-err">Ne correspond pas.</p>}
          </div>
        </div>

        <PasswordStrength password={pwd} />

        {msg?.error   && <p className="profile-status-err">{msg.error}</p>}
        {msg?.message && <p className="profile-status-ok">{msg.message}</p>}

        <div>
          <button
            type="submit"
            className="profile-btn-primary"
            disabled={pending || !current || !pwd || !confirm || mismatch}
          >
            {pending ? 'Mise à jour…' : 'Changer le mot de passe'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Page ── */

export default function ProfilePage() {
  return (
    <main className="profile-page">
      <header className="profile-page-header">
        <h1>Mon profil</h1>
        <p className="profile-page-subtitle">
          Gérez vos informations personnelles et votre sécurité.
        </p>
      </header>

      <div className="profile-grid">
        <AvatarCard />
        <div className="profile-right">
          <InfoCard />
          <PasswordCard />
        </div>
      </div>
    </main>
  );
}
