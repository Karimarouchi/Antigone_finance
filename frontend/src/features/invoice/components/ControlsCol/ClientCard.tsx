import { useState, useEffect, useRef } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { useClients } from '@/features/invoice/hooks/useClients';
import { fmtDate } from '@/features/invoice/utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT_ALT } from '@/lib/framer-motion-constants';
import { CustomSelect } from '@/components/ui/custom-select';
import GlowCard from '@/components/GlowCard';

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Mensuel', quarterly: 'Trimestriel',
  'semi-annual': 'Semestriel', yearly: 'Annuel', one_shot: 'Unique',
};

function LogoDropZone({ onFile }: { onFile: (file: File | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    onFile(file);
  }

  return (
    <div
      className={`logo-drop-zone${isDragging ? ' drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="logo-drop-preview">
          <img src={preview} alt="Logo preview" className="logo-preview-img" />
          <button
            type="button"
            className="logo-remove-btn"
            onClick={(e) => { e.stopPropagation(); setPreview(null); onFile(null); }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ) : (
        <div className="logo-drop-idle">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="icon-faint">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span className="logo-drop-label">Glisser une image ici</span>
          <span className="logo-drop-sub">ou <span className="logo-drop-browse">parcourir</span></span>
        </div>
      )}
    </div>
  );
}

export default function ClientCard() {
  const { state, dispatch } = useInvoice();
  const { loadClients, selectClient, saveNewClient, editClient, deleteClient } = useClients();

  const [open, setOpen] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);

  const [ncName, setNcName] = useState('');
  const [ncMF, setNcMF] = useState('');
  const [ncJoining, setNcJoining] = useState('');
  const [ncBilling, setNcBilling] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [ncLogoFile, setNcLogoFile] = useState<File | null>(null);
  const [ncStatus, setNcStatus] = useState('');

  const [ecName, setEcName] = useState('');
  const [ecMF, setEcMF] = useState('');
  const [ecJoining, setEcJoining] = useState('');
  const [ecBilling, setEcBilling] = useState('');
  const [ecEmail, setEcEmail] = useState('');
  const [ecLogoFile, setEcLogoFile] = useState<File | null>(null);
  const [ecStatus, setEcStatus] = useState('');

  useEffect(() => {
    loadClients().then(setClients);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSelectClient(id: string) {
    await selectClient(id || null);
  }

  async function handleSaveNewClient() {
    if (!ncName.trim()) { setNcStatus('Le nom est requis.'); return; }
    setNcStatus('Enregistrement…');
    const saved = await saveNewClient({
      name: ncName, matriculeFiscale: ncMF,
      joiningDate: ncJoining, billingCycle: ncBilling, email: ncEmail, logoFile: ncLogoFile,
    });
    if (!saved) { setNcStatus('Erreur — veuillez réessayer.'); return; }
    const updated = await loadClients();
    setClients(updated);
    await selectClient(saved.id);
    setNcName(''); setNcMF(''); setNcJoining(''); setNcBilling(''); setNcEmail(''); setNcLogoFile(null);
    setNcStatus('');
    setShowNewForm(false);
  }

  function openEditForm() {
    const c = state.currentClient;
    if (!c) return;
    setEcName(c.name || '');
    setEcMF(c.matricule_fiscale || '');
    setEcJoining(c.joining_date || '');
    setEcBilling(c.billing_cycle || '');
    setEcEmail(c.email || '');
    setEcLogoFile(null);
    setEcStatus('');
    setShowEditForm((v) => !v);
  }

  async function handleSaveEdit() {
    if (!ecName.trim()) { setEcStatus('Le nom est requis.'); return; }
    setEcStatus('Mise à jour…');
    const saved = await editClient(state.currentClient.id, {
      name: ecName, matriculeFiscale: ecMF,
      joiningDate: ecJoining, billingCycle: ecBilling, email: ecEmail, logoFile: ecLogoFile,
    });
    if (!saved) { setEcStatus('Erreur — veuillez réessayer.'); return; }
    const updated = await loadClients();
    setClients(updated);
    setEcStatus('');
    setShowEditForm(false);
  }

  async function handleDelete() {
    if (!state.currentClient) return;
    if (!window.confirm(`Archiver « ${state.currentClient.commercial_name || state.currentClient.name} » dans les anciens clients ?`)) return;
    await deleteClient(state.currentClient.id);
    const updated = await loadClients();
    setClients(updated);
    dispatch({ type: 'SET_FIELD', key: 'currentClient', value: null });
  }

  const c = state.currentClient;

  return (
    <GlowCard><div className="card">
      <motion.div
        className="card-head"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer' }}
        whileTap={{ scale: 0.98 }}
      >
        <span>Client</span>
        <motion.div
          className="card-chev"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </motion.div>
      </motion.div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="card-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT_ALT }}
            style={{ overflow: 'hidden' }}
          >
          <div className="field">
            <label>Sélectionner un client</label>
            <CustomSelect
              value={c?.id || ''}
              onChange={handleSelectClient}
              options={clients.map((cl) => ({ value: cl.id, label: cl.commercial_name || cl.name }))}
              placeholder="Choisir un client"
            />
          </div>

          {c && (
            <div className="client-info-box">
              <div className="client-info-header">
                <div>
                  <div className="client-info-label">Matricule Fiscale</div>
                  <div className="client-info-value">{c.matricule_fiscale || '—'}</div>
                </div>
                {c.logo_url && (
                  <div>
                    <img src={c.logo_url} alt="Logo" style={{ maxHeight: 40, maxWidth: 80, objectFit: 'contain' }} />
                  </div>
                )}
              </div>
              <div className="client-info-cols">
                <div className="client-info-col">
                  <div className="client-info-label">Date d&apos;adhésion</div>
                  <div className="client-info-value">{c.joining_date ? fmtDate(c.joining_date) : '—'}</div>
                </div>
                <div className="client-info-col">
                  <div className="client-info-label">Cycle de facturation</div>
                  <div className="client-info-value">{BILLING_LABELS[c.billing_cycle] || '—'}</div>
                </div>
              </div>
              {c.email && (
                <div style={{ marginTop: 6 }}>
                  <div className="client-info-label">Email</div>
                  <div className="client-info-value" style={{ fontSize: 12 }}>{c.email}</div>
                </div>
              )}
            </div>
          )}

          {c && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn-pill btn-pill--ghost" style={{ flex: 1 }} onClick={openEditForm}>
                Modifier
              </button>
              <button className="btn-pill btn-pill--danger" style={{ flex: 1 }} onClick={handleDelete}>
                Archiver
              </button>
            </div>
          )}

          {showEditForm && c && (
            <div style={{ marginTop: 10, padding: 14, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginBottom: 10 }}>
                Modifier le client
              </div>
              <div className="field"><label>Nom du client *</label>
                <input type="text" value={ecName} onChange={(e) => setEcName(e.target.value)} />
              </div>
              <div className="field"><label>Matricule Fiscale</label>
                <input type="text" value={ecMF} onChange={(e) => setEcMF(e.target.value)} />
              </div>
              <div className="field"><label>Date d&apos;adhésion</label>
                <DatePicker value={ecJoining} onChange={setEcJoining} />
              </div>
              <div className="field">
                <label>Cycle de facturation</label>
                <CustomSelect
                  value={ecBilling}
                  onChange={setEcBilling}
                  options={[
                    { value: 'monthly', label: 'Mensuel' },
                    { value: 'quarterly', label: 'Trimestriel' },
                    { value: 'semi-annual', label: 'Semestriel' },
                    { value: 'yearly', label: 'Annuel' },
                    { value: 'one_shot', label: 'Unique' },
                  ]}
                  placeholder="— Sélectionner —"
                  size="sm"
                />
              </div>
              <div className="field"><label>Email du client</label>
                <input type="email" placeholder="ex: client@example.com" value={ecEmail} onChange={(e) => setEcEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>Nouveau logo (optionnel)</label>
                {c.logo_url && !ecLogoFile && (
                  <img src={c.logo_url} alt="Logo actuel" style={{ height: 40, objectFit: 'contain', borderRadius: 4, marginBottom: 6, display: 'block' }} />
                )}
                <LogoDropZone onFile={setEcLogoFile} />
              </div>
              <button className="btn-pill btn-pill--accent" style={{ width: '100%', padding: 11, marginTop: 8 }} onClick={handleSaveEdit}>
                Mettre à jour
              </button>
              {ecStatus && <div className="form-status">{ecStatus}</div>}
            </div>
          )}

          <div className="divider-light" />
          <button type="button" className="btn-pill btn-pill--ghost" onClick={() => setShowNewForm((v) => !v)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Nouveau client
          </button>

          {showNewForm && (
            <div className="new-client-form">
              <div className="new-client-form-title">Nouveau client</div>
              <div className="field">
                <label>Nom du client *</label>
                <input type="text" placeholder="ex: Client" value={ncName} onChange={(e) => setNcName(e.target.value)} />
              </div>
              <div className="field">
                <label>Matricule Fiscale</label>
                <input type="text" placeholder="ex: 001365/W/A/M/000" value={ncMF} onChange={(e) => setNcMF(e.target.value)} />
              </div>
              <div className="field">
                <label>Date d&apos;adhésion</label>
                <DatePicker value={ncJoining} onChange={setNcJoining} />
              </div>
              <div className="field">
                <label>Cycle de facturation</label>
                <CustomSelect
                  value={ncBilling}
                  onChange={setNcBilling}
                  options={[
                    { value: 'monthly', label: 'Mensuel' },
                    { value: 'quarterly', label: 'Trimestriel' },
                    { value: 'semi-annual', label: 'Semestriel' },
                    { value: 'yearly', label: 'Annuel' },
                    { value: 'one_shot', label: 'Unique' },
                  ]}
                  placeholder="— Sélectionner —"
                  size="sm"
                />
              </div>
              <div className="field">
                <label>Email du client</label>
                <input type="email" placeholder="ex: client@example.com" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} />
              </div>
              <div className="field">
                <label>Logo (optionnel)</label>
                <LogoDropZone onFile={setNcLogoFile} />
              </div>
              <button type="button" className="btn-pill btn-pill--accent" onClick={handleSaveNewClient}>
                Enregistrer
              </button>
              {ncStatus && <div className="form-status">{ncStatus}</div>}
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>
    </div></GlowCard>
  );
}
