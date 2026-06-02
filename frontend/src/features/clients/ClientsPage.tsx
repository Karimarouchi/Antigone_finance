import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { DatePicker } from '@/components/ui/date-picker';
import { CustomSelect } from '@/components/ui/custom-select';
import { api } from '@/lib/api';
import { EASE_OUT, EASE_OUT_ALT } from '@/lib/framer-motion-constants';
import { ROUTES } from '@/config/routes';
import './clients.css';

/* ── Helpers ── */

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  'semi-annual': 'Semestriel',
  yearly: 'Annuel',
  one_shot: 'Unique',
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function getInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function dn(c: { commercialName?: string | null; name: string }) {
  return c.commercialName?.trim() || c.name;
}

const AVATAR_COLORS = ['#e8621a', '#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#be185d'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

/* ── Types ── */

interface ClientProfile {
  id: string;
  name: string;
  commercialName: string | null;
  matriculeFiscale: string | null;
  rne: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  email: string | null;
  emailReceiverName: string | null;
  emailReceiverGender: string | null;
  joiningDate: string | null;
  billingCycle: string | null;
  logoUrl: string | null;
  deletedAt: string | null;
}

/* ── Stagger ── */

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 24 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { duration: 0.4, delay: i * 0.07, ease: EASE_OUT_ALT },
});

/* ── Countries list ── */

const COUNTRIES = [
  'Afghanistan','Afrique du Sud','Albanie','Algérie','Allemagne','Angola','Arabie saoudite','Argentine','Arménie',
  'Australie','Autriche','Azerbaïdjan','Bahreïn','Bangladesh','Belgique','Bénin','Biélorussie','Bolivie',
  'Bosnie-Herzégovine','Brésil','Bulgarie','Burkina Faso','Burundi','Cameroun','Canada','Chili','Chine',
  'Chypre','Colombie','Congo','Corée du Sud','Côte d\'Ivoire','Croatie','Cuba','Danemark','Égypte',
  'Émirats arabes unis','Équateur','Espagne','Estonie','Éthiopie','États-Unis','Finlande','France','Gabon',
  'Ghana','Grèce','Guatemala','Guinée','Haïti','Hongrie','Inde','Indonésie','Irak','Iran','Irlande',
  'Islande','Israël','Italie','Jamaïque','Japon','Jordanie','Kazakhstan','Kenya','Koweït','Laos','Lettonie',
  'Liban','Libye','Lituanie','Luxembourg','Madagascar','Mali','Maroc','Maurice','Mauritanie','Mexique',
  'Moldavie','Mongolie','Mozambique','Myanmar','Namibie','Népal','Nicaragua','Niger','Nigéria','Norvège',
  'Nouvelle-Zélande','Oman','Ouganda','Ouzbékistan','Pakistan','Palestine','Panama','Paraguay','Pays-Bas',
  'Pérou','Philippines','Pologne','Portugal','Qatar','République dominicaine','Roumanie','Royaume-Uni',
  'Russie','Rwanda','Sénégal','Serbie','Sierra Leone','Singapour','Slovaquie','Slovénie','Somalie','Soudan',
  'Sri Lanka','Suède','Suisse','Syrie','Tanzanie','Tchad','Thaïlande','Togo','Tunisie','Turquie','Ukraine',
  'Uruguay','Venezuela','Viêt Nam','Yémen','Zambie','Zimbabwe',
];

/* ── Shared form fields state ── */

interface FormState {
  name: string;
  commercialName: string;
  matriculeFiscale: string;
  rne: string;
  industry: string;
  country: string;
  city: string;
  address: string;
  email: string;
  emailReceiverName: string;
  emailReceiverGender: string;
  joiningDate: string;
  billingCycle: string;
  logoFile: File | null;
}

const emptyForm = (): FormState => ({
  name: '', commercialName: '', matriculeFiscale: '', rne: '', industry: '',
  country: '', city: '', address: '',
  email: '', emailReceiverName: '', emailReceiverGender: '',
  joiningDate: '', billingCycle: '', logoFile: null,
});

function fromClient(c: ClientProfile): FormState {
  return {
    name: c.name || '',
    commercialName: c.commercialName || '',
    matriculeFiscale: c.matriculeFiscale || '',
    rne: c.rne || '',
    industry: c.industry || '',
    country: c.country || '',
    city: c.city || '',
    address: c.address || '',
    email: c.email || '',
    emailReceiverName: c.emailReceiverName || '',
    emailReceiverGender: c.emailReceiverGender || '',
    joiningDate: c.joiningDate || '',
    billingCycle: c.billingCycle || '',
    logoFile: null,
  };
}

/* ── Logo Dropzone ── */

function LogoDropzone({ form, setForm, logoPreview }: {
  form: FormState;
  setForm: (f: FormState) => void;
  logoPreview?: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);

  const previewSrc = form.logoFile
    ? URL.createObjectURL(form.logoFile)
    : logoPreview ?? null;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) setForm({ ...form, logoFile: file });
  }

  if (previewSrc) {
    return (
      <div className="modal-logo-preview-wrap">
        <img src={previewSrc} alt="Logo" className="modal-logo-preview-thumb" />
        <div className="modal-logo-preview-info">
          <div className="modal-logo-preview-name">{form.logoFile ? form.logoFile.name : 'Logo actuel'}</div>
          {form.logoFile && (
            <div className="modal-logo-preview-size">{(form.logoFile.size / 1024).toFixed(0)} Ko</div>
          )}
        </div>
        <button
          type="button"
          className="modal-logo-remove-btn"
          onClick={() => setForm({ ...form, logoFile: null })}
          title="Supprimer"
        >
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`modal-logo-dropzone${dragOver ? ' drag-over' : ''}`}
      onDragEnter={() => setDragOver(true)}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setForm({ ...form, logoFile: e.target.files?.[0] ?? null })}
      />
      <div className="modal-logo-dropzone-icon">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      </div>
      <div className="modal-logo-dropzone-text">
        <strong>Glissez le logo ici</strong>
        {' '}ou cliquez pour parcourir
      </div>
      <div className="modal-logo-dropzone-hint">PNG, JPG, SVG — max 2 Mo</div>
    </div>
  );
}

/* ── Client Form ── */

function ClientForm({ form, setForm, logoPreview }: {
  form: FormState;
  setForm: (f: FormState) => void;
  logoPreview?: string | null;
}) {
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <>
      <div className="modal-section-card">
        <div className="modal-section-hdr">
          <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span className="modal-section-label">Société</span>
        </div>
        <div className="modal-section-body">
          <div className="modal-fields-row">
            <div className="field">
              <label>Dénomination Légale <span className="req">*</span></label>
              <input type="text" placeholder="ex: Antigone Creative Agency" value={form.name} onChange={set('name')} autoFocus />
            </div>
            <div className="field">
              <label>Dénomination Commerciale</label>
              <input type="text" placeholder="ex: Antigone" value={form.commercialName} onChange={set('commercialName')} />
            </div>
          </div>
          <div className="modal-fields-row">
            <div className="field">
              <label>Matricule Fiscale</label>
              <input type="text" placeholder="ex: 001365/W/A/M/000" value={form.matriculeFiscale} onChange={set('matriculeFiscale')} />
            </div>
            <div className="field">
              <label>RNE / Immatriculation</label>
              <input type="text" placeholder="ex: B123456789" value={form.rne} onChange={set('rne')} />
            </div>
          </div>
          <div className="field">
            <label>Secteur d&apos;activité</label>
            <input type="text" placeholder="ex: Design, Tech, Restauration…" value={form.industry} onChange={set('industry')} />
          </div>
        </div>
      </div>

      <div className="modal-section-card">
        <div className="modal-section-hdr">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span className="modal-section-label">Email</span>
        </div>
        <div className="modal-section-body">
          <div className="field">
            <label>Email (service financier)</label>
            <input type="email" placeholder="ex: finance@client.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="modal-fields-row">
            <div className="field">
              <label>Nom du destinataire</label>
              <input type="text" placeholder="ex: Ben Salah" value={form.emailReceiverName} onChange={set('emailReceiverName')} />
            </div>
            <div className="field">
              <label>Civilité</label>
              <CustomSelect
                value={form.emailReceiverGender}
                onChange={(v) => setForm({ ...form, emailReceiverGender: v })}
                options={[{ value: 'M.', label: 'M.' }, { value: 'Mme', label: 'Mme' }]}
                placeholder="— Sélectionner —"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="modal-section-card">
        <div className="modal-section-hdr">
          <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span className="modal-section-label">Localisation</span>
        </div>
        <div className="modal-section-body">
          <div className="modal-fields-row">
            <div className="field">
              <label>Pays</label>
              <CustomSelect
                value={form.country}
                onChange={(v) => setForm({ ...form, country: v })}
                options={COUNTRIES.map((c) => ({ value: c, label: c }))}
                placeholder="— Sélectionner —"
              />
            </div>
            <div className="field">
              <label>Ville</label>
              <input type="text" placeholder="ex: Tunis" value={form.city} onChange={set('city')} />
            </div>
          </div>
          <div className="field">
            <label>Adresse</label>
            <input type="text" placeholder="ex: 12 Rue de la Liberté" value={form.address} onChange={set('address')} />
          </div>
        </div>
      </div>

      <div className="modal-section-card">
        <div className="modal-section-hdr">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span className="modal-section-label">Facturation</span>
        </div>
        <div className="modal-section-body">
          <div className="field">
            <label>Date d&apos;adhésion</label>
            <DatePicker value={form.joiningDate} onChange={(v) => setForm({ ...form, joiningDate: v })} />
          </div>
          <div className="field">
            <label>Cycle de facturation</label>
            <CustomSelect
              value={form.billingCycle}
              onChange={(v) => setForm({ ...form, billingCycle: v })}
              options={[
                { value: 'monthly', label: 'Mensuel' },
                { value: 'quarterly', label: 'Trimestriel' },
                { value: 'semi-annual', label: 'Semestriel' },
                { value: 'yearly', label: 'Annuel' },
                { value: 'one_shot', label: 'Unique' },
              ]}
              placeholder="— Sélectionner —"
            />
          </div>
        </div>
      </div>

      <div className="modal-section-card full-width">
        <div className="modal-section-hdr">
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span className="modal-section-label">Logo</span>
        </div>
        <div className="modal-section-body">
          <LogoDropzone form={form} setForm={setForm} logoPreview={logoPreview} />
        </div>
      </div>
    </>
  );
}

/* ── Shared modal shell ── */

function ClientModal({ open, title, subtitle, onClose, onSave, status, children }: {
  open: boolean; title: string; subtitle?: string; onClose: () => void; onSave: () => void; status: string; children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="add-client-modal"
            initial={{ scale: 0.93, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">{title}</div>
                {subtitle && <div className="modal-topbar-sub">{subtitle}</div>}
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>

            <div className="modal-scroll-body">
              {children}
            </div>

            {status && <div className="modal-status">{status}</div>}

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={onSave} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}>Enregistrer</motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Add Client Modal ── */

function AddClientModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [status, setStatus] = useState('');

  async function handleSave() {
    if (!form.name.trim()) { setStatus('La dénomination légale est requise.'); return; }
    setStatus('Enregistrement…');

    let logoUrl: string | null = null;
    if (form.logoFile) {
      try {
        const fd = new FormData();
        fd.append('file', form.logoFile);
        const up = await api.post<{ url: string }>('/api/storage/upload/client-logos', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logoUrl = up.data.url;
      } catch {
        setStatus('Échec de l’upload du logo.'); return;
      }
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      commercialName: form.commercialName || null,
      matriculeFiscale: form.matriculeFiscale || null,
      rne: form.rne || null,
      industry: form.industry || null,
      country: form.country || null,
      city: form.city || null,
      address: form.address || null,
      email: form.email || null,
      emailReceiverName: form.emailReceiverName || null,
      emailReceiverGender: form.emailReceiverGender || null,
      joiningDate: form.joiningDate || null,
      billingCycle: form.billingCycle || null,
      logoUrl,
    };

    try {
      await api.post('/api/clients', payload);
      setForm(emptyForm()); setStatus(''); onSaved(); onClose();
    } catch {
      setStatus('Erreur — veuillez réessayer.');
    }
  }

  return (
    <ClientModal open={open} title="Nouveau client" subtitle="Remplissez les informations pour ajouter un client à votre portefeuille." onClose={() => { setForm(emptyForm()); setStatus(''); onClose(); }} onSave={handleSave} status={status}>
      <ClientForm form={form} setForm={setForm} />
    </ClientModal>
  );
}

/* ── Edit Client Modal ── */

function EditClientModal({ client, onClose, onSaved }: { client: ClientProfile | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [status, setStatus] = useState('');

  useEffect(() => { if (client) { setForm(fromClient(client)); setStatus(''); } }, [client]);

  async function handleSave() {
    if (!client) return;
    if (!form.name.trim()) { setStatus('La dénomination légale est requise.'); return; }
    setStatus('Mise à jour…');

    let logoUrl: string | null | undefined = undefined;
    if (form.logoFile) {
      try {
        const fd = new FormData();
        fd.append('file', form.logoFile);
        const up = await api.post<{ url: string }>('/api/storage/upload/client-logos', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        logoUrl = up.data.url;
      } catch {
        setStatus('Échec de l’upload du logo.'); return;
      }
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      commercialName: form.commercialName || null,
      matriculeFiscale: form.matriculeFiscale || null,
      rne: form.rne || null,
      industry: form.industry || null,
      country: form.country || null,
      city: form.city || null,
      address: form.address || null,
      email: form.email || null,
      emailReceiverName: form.emailReceiverName || null,
      emailReceiverGender: form.emailReceiverGender || null,
      joiningDate: form.joiningDate || null,
      billingCycle: form.billingCycle || null,
    };
    if (logoUrl !== undefined) payload.logoUrl = logoUrl;

    try {
      await api.put(`/api/clients/${client.id}`, payload);
      onSaved(); onClose();
    } catch {
      setStatus('Erreur — veuillez réessayer.');
    }
  }

  return (
    <ClientModal open={!!client} title="Modifier le client" subtitle={client ? `Mise à jour du profil — ${dn(client)}` : undefined} onClose={onClose} onSave={handleSave} status={status}>
      <ClientForm form={form} setForm={setForm} logoPreview={client?.logoUrl} />
    </ClientModal>
  );
}

/* ── Client Card ── */

function ClientCard({ client, index, onEdit, onArchive, onRestore, isArchived }: {
  client: ClientProfile; index: number; onEdit: (c: ClientProfile) => void;
  onArchive?: (c: ClientProfile) => void; onRestore?: (c: ClientProfile) => void; isArchived?: boolean;
}) {
  const c = client;
  const navigate = useNavigate();

  return (
    <motion.div
      className={`client-card${isArchived ? ' client-card--archived' : ''}`}
      {...stagger(index + 1)}
      onClick={() => navigate(ROUTES.app.clientDetail.replace(':id', c.id))}
      style={{ cursor: 'pointer' }}
    >
      <div className="client-card-top">
        <div className="client-avatar" style={{ background: c.logoUrl ? 'transparent' : avatarColor(dn(c)) }}>
          {c.logoUrl ? <img src={c.logoUrl} alt={dn(c)} /> : getInitials(dn(c))}
        </div>
        <div className="client-card-identity">
          <div className="client-card-name">{dn(c)}</div>
          <div className="client-card-mf">
            {[c.industry, c.city, c.country].filter(Boolean).join(' · ') || c.matriculeFiscale || 'Aucune information'}
          </div>
        </div>
        <div className="client-card-actions">
          <motion.button title="Modifier" onClick={(e) => { e.stopPropagation(); onEdit(c); }} whileTap={{ scale: 0.85 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </motion.button>
          {onArchive && (
            <motion.button title="Archiver" className="client-action-archive" onClick={(e) => { e.stopPropagation(); onArchive(c); }} whileTap={{ scale: 0.85 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </motion.button>
          )}
          {onRestore && (
            <motion.button title="Restaurer" className="client-action-restore" onClick={(e) => { e.stopPropagation(); onRestore(c); }} whileTap={{ scale: 0.85 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/>
              </svg>
            </motion.button>
          )}
        </div>
      </div>

      <div className="client-card-body">
        <div className="client-tags">
          {c.billingCycle && (
            <span className="client-tag client-tag--blue"><span className="tag-dot" />{BILLING_LABELS[c.billingCycle] ?? c.billingCycle}</span>
          )}
        </div>

        <div className="client-info-rows">
          {c.matriculeFiscale && (
            <div className="client-info-row">
              <span className="client-info-row-label">Matricule Fiscale</span>
              <span className="client-info-row-value">{c.matriculeFiscale}</span>
            </div>
          )}
          {c.rne && (
            <div className="client-info-row">
              <span className="client-info-row-label">RNE</span>
              <span className="client-info-row-value">{c.rne}</span>
            </div>
          )}
          {c.address && (
            <div className="client-info-row">
              <span className="client-info-row-label">Adresse</span>
              <span className="client-info-row-value">{c.address}</span>
            </div>
          )}
          {c.joiningDate && (
            <div className="client-info-row">
              <span className="client-info-row-label">Adhésion</span>
              <span className="client-info-row-value">{fmtDate(c.joiningDate)}</span>
            </div>
          )}
          {c.email && (
            <div className="client-info-row">
              <span className="client-info-row-label">Email</span>
              <span className="client-info-row-value">{c.email}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Table View ── */

type SortKey = 'name' | 'matriculeFiscale' | 'rne' | 'industry' | 'country' | 'city' | 'address' | 'joiningDate' | 'billingCycle';

function ClientsTable({ clients, onEdit, onArchive, onRestore }: {
  clients: ClientProfile[]; onEdit: (c: ClientProfile) => void;
  onArchive?: (c: ClientProfile) => void; onRestore?: (c: ClientProfile) => void;
}) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...clients].sort((a, b) => {
    let av: string = String(a[sortKey] ?? '').toLowerCase();
    let bv: string = String(b[sortKey] ?? '').toLowerCase();
    return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const Th = ({ col, label }: { col: SortKey; label: string }) => (
    <th onClick={() => toggleSort(col)} className={sortKey === col ? 'sorted' : ''}>
      <div className="th-inner">
        {label}
        <svg className="sort-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          {sortKey === col
            ? sortAsc ? <path d="M12 19V5M5 12l7-7 7 7"/> : <path d="M12 5v14M5 12l7 7 7-7"/>
            : <><path d="M12 5v14"/><path d="M5 9l7-7 7 7" opacity="0.4"/><path d="M5 15l7 7 7-7" opacity="0.4"/></>}
        </svg>
      </div>
    </th>
  );

  return (
    <motion.div className="clients-table-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} style={{ overflowX: 'auto' }}>
      <table className="clients-table">
        <thead>
          <tr>
            <Th col="name" label="Dénomination Légale" />
            <Th col="matriculeFiscale" label="Matricule Fiscale" />
            <Th col="rne" label="RNE" />
            <Th col="industry" label="Secteur" />
            <Th col="country" label="Pays" />
            <Th col="city" label="Ville" />
            <Th col="address" label="Adresse" />
            <Th col="joiningDate" label="Adhésion" />
            <Th col="billingCycle" label="Cycle" />
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c, i) => (
            <motion.tr key={c.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: i * 0.04 }}
              onClick={() => navigate(ROUTES.app.clientDetail.replace(':id', c.id))}
              style={{ cursor: 'pointer' }}
            >
              <td>
                <div className="table-client-cell">
                  <div className="table-avatar" style={{ background: c.logoUrl ? 'transparent' : avatarColor(dn(c)) }}>
                    {c.logoUrl ? <img src={c.logoUrl} alt={dn(c)} /> : getInitials(dn(c))}
                  </div>
                  <div className="table-client-name">{dn(c)}</div>
                </div>
              </td>
              <td>{c.matriculeFiscale || '—'}</td>
              <td>{c.rne || '—'}</td>
              <td>{c.industry || '—'}</td>
              <td>{c.country || '—'}</td>
              <td>{c.city || '—'}</td>
              <td>{c.address || '—'}</td>
              <td>{c.joiningDate ? fmtDate(c.joiningDate) : '—'}</td>
              <td>{c.billingCycle ? (BILLING_LABELS[c.billingCycle] ?? c.billingCycle) : '—'}</td>
              <td>
                <div className="table-row-actions">
                  <motion.button className="table-edit-btn" onClick={(e) => { e.stopPropagation(); onEdit(c); }} whileTap={{ scale: 0.85 }} title="Modifier">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </motion.button>
                  {onArchive && (
                    <motion.button className="table-edit-btn table-archive-btn" onClick={(e) => { e.stopPropagation(); onArchive(c); }} whileTap={{ scale: 0.85 }} title="Archiver">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                      </svg>
                    </motion.button>
                  )}
                  {onRestore && (
                    <motion.button className="table-edit-btn table-restore-btn" onClick={(e) => { e.stopPropagation(); onRestore(c); }} whileTap={{ scale: 0.85 }} title="Restaurer">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-11.36L1 10"/>
                      </svg>
                    </motion.button>
                  )}
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}

/* ── Main Page ── */

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientProfile | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [showArchived, setShowArchived] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ClientProfile[]>('/api/clients');
      setClients(data);
    } catch (err) {
      console.error('loadClients:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function archiveClient(c: ClientProfile) {
    try {
      await api.delete(`/api/clients/${c.id}`);
      loadAll();
    } catch (err) {
      console.error('archiveClient:', err);
    }
  }

  async function restoreClient(c: ClientProfile) {
    try {
      await api.put(`/api/clients/${c.id}/restore`, {});
      loadAll();
    } catch (err) {
      console.error('restoreClient:', err);
    }
  }

  const activeClients = clients.filter((c) => !c.deletedAt);
  const archivedClients = clients.filter((c) => !!c.deletedAt);

  return (
    <div className="clients-page">
      {/* ── Page switcher ── */}
      <motion.div
        style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
      >
        <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 9999, background: 'var(--surface, #eaeff1)' }}>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <Link to="/about" style={{ display: 'block', padding: '9px 28px', borderRadius: 9999, border: '1px solid transparent', background: '#f46a03', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(244,106,3,0.3)' }}>Clients</Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
            <Link to="/contacts" style={{ display: 'block', padding: '9px 28px', borderRadius: 9999, border: '1px solid var(--border, #e0e0e5)', background: 'transparent', color: 'var(--muted, #888)', fontWeight: 600, fontSize: 14, textDecoration: 'none', whiteSpace: 'nowrap' }}>Contacts</Link>
          </motion.div>
        </div>
      </motion.div>

      <motion.div className="clients-page-header" {...stagger(0)}>
        <div>
          <h1 className="clients-page-title">Clients</h1>
          <p className="clients-page-subtitle">{activeClients.length} client{activeClients.length !== 1 ? 's' : ''} actif{activeClients.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="clients-page-header-right">
          <div className="view-toggle">
            <motion.button className={`view-toggle-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} whileTap={{ scale: 0.9 }} title="Vue grille">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </motion.button>
            <motion.button className={`view-toggle-btn${viewMode === 'table' ? ' active' : ''}`} onClick={() => setViewMode('table')} whileTap={{ scale: 0.9 }} title="Vue tableau">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </motion.button>
          </div>
          <motion.button className="btn-add-client" onClick={() => setModalOpen(true)} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ajouter un client
          </motion.button>
        </div>
      </motion.div>

      {/* ── Clients Actuels ── */}
      {loading ? (
        <div className="clients-loading">
          {[0, 1, 2].map((i) => <div key={i} className="client-card-skeleton" />)}
        </div>
      ) : activeClients.length === 0 ? (
        <motion.div className="clients-empty" {...stagger(1)}>
          <div className="clients-empty-icon">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          </div>
          <div className="clients-empty-title">Aucun client actif</div>
          <div className="clients-empty-text">Ajoutez votre premier client pour commencer.</div>
        </motion.div>
      ) : viewMode === 'table' ? (
        <ClientsTable clients={activeClients} onEdit={setEditTarget} onArchive={archiveClient} />
      ) : (
        <div className="clients-grid">
          {activeClients.map((c, i) => <ClientCard key={c.id} client={c} index={i} onEdit={setEditTarget} onArchive={archiveClient} />)}
        </div>
      )}

      {/* ── Anciens Clients ── */}
      {!loading && archivedClients.length > 0 && (
        <div className="archived-section">
          <motion.button
            className="archived-toggle"
            onClick={() => setShowArchived((v) => !v)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <svg className={`archived-chevron ${showArchived ? 'archived-chevron--open' : ''}`} viewBox="0 0 24 24">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <span className="archived-toggle-label">Anciens Clients</span>
            <span className="archived-count">{archivedClients.length}</span>
          </motion.button>

          <AnimatePresence>
            {showArchived && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT_ALT }}
                style={{ overflow: 'hidden' }}
              >
                {viewMode === 'table' ? (
                  <ClientsTable clients={archivedClients} onEdit={setEditTarget} onRestore={restoreClient} />
                ) : (
                  <div className="clients-grid">
                    {archivedClients.map((c, i) => (
                      <ClientCard key={c.id} client={c} index={i} onEdit={setEditTarget} onRestore={restoreClient} isArchived />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AddClientModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={loadAll} />
      <EditClientModal client={editTarget} onClose={() => setEditTarget(null)} onSaved={loadAll} />
    </div>
  );
}
