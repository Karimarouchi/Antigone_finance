import { useState, useEffect, useCallback, useMemo } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT } from '@/lib/framer-motion-constants';
import { useMoisCourant } from './MoisContext';
import api from '@/lib/api';
import '@/features/clients/clients.css';
import './decaissements.css';

/* ── Types ── */
interface DettePaiement {
  id: string;
  detteId: string;
  montant: number;
  date: string;
  note: string;
  createdAt: string;
}

interface Dette {
  id: string;
  creancier: string;
  montantTotal: number;
  montantPaye: number;
  dateEcheance: string | null;
  notes: string;
  archivedAt: string | null;
  createdAt: string;
  paiements: DettePaiement[];
}

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/* ── Hook ── */
function useDettes() {
  const [dettes,  setDettes]  = useState<Dette[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dettesRes, paiementsRes] = await Promise.all([
        api.get<Dette[]>('/api/dettes'),
        api.get<DettePaiement[]>('/api/dettes/paiements').catch(() => ({ data: [] as DettePaiement[] })),
      ]);
      const rawPaiements: DettePaiement[] = paiementsRes.data ?? [];
      const mapped: Dette[] = (dettesRes.data ?? []).map((d) => ({
        ...d,
        paiements: rawPaiements.filter((p) => p.detteId === d.id),
      }));
      setDettes(mapped);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addDette = useCallback(async (data: {
    creancier: string; montantTotal: number; dateEcheance: string | null; notes: string;
  }) => {
    try {
      const { data: inserted } = await api.post<Dette>('/api/dettes', data);
      if (inserted) setDettes((prev) => [{ ...inserted, paiements: [] }, ...prev]);
    } catch { /* ignore */ }
  }, []);

  const removeDette = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setDettes((prev) => prev.map((d) => d.id === id ? { ...d, archivedAt: now } : d));
    try { await api.delete(`/api/dettes/${id}`); }
    catch { setDettes((prev) => prev.map((d) => d.id === id ? { ...d, archivedAt: null } : d)); }
  }, []);

  const addPaiement = useCallback(async (detteId: string, montant: number, dateISO: string) => {
    let newMontantPaye = 0;
    setDettes((prev) => prev.map((d) => {
      if (d.id !== detteId) return d;
      newMontantPaye = +Math.min(d.montantPaye + montant, d.montantTotal).toFixed(3);
      const tempPay: DettePaiement = { id: crypto.randomUUID(), detteId, montant, date: dateISO, note: '', createdAt: new Date().toISOString() };
      return { ...d, montantPaye: newMontantPaye, paiements: [...d.paiements, tempPay] };
    }));
    try {
      const { data: p } = await api.post<DettePaiement>(`/api/dettes/${detteId}/paiements`, { montant, date: dateISO });
      if (p) {
        setDettes((prev) => prev.map((d) => {
          if (d.id !== detteId) return d;
          return { ...d, montantPaye: newMontantPaye, paiements: [...d.paiements.filter((pp) => pp.id !== p.id), p] };
        }));
      }
    } catch { load(); }
  }, [load]);

  const activeDettes   = useMemo(() => dettes.filter((d) => !d.archivedAt), [dettes]);
  const archivedDettes = useMemo(() => dettes.filter((d) => !!d.archivedAt), [dettes]);
  const totalDette   = useMemo(() => activeDettes.reduce((s, d) => s + d.montantTotal, 0), [activeDettes]);
  const totalPaye    = useMemo(() => activeDettes.reduce((s, d) => s + d.montantPaye, 0), [activeDettes]);
  const totalRestant = useMemo(() => activeDettes.reduce((s, d) => s + Math.max(0, d.montantTotal - d.montantPaye), 0), [activeDettes]);

  return { dettes: activeDettes, archivedDettes, totalDette, totalPaye, totalRestant, loading, addDette, removeDette, addPaiement };
}

/* ── Add dette modal ── */
function AddDetteModal({ open, onClose, onAdd }: {
  open: boolean; onClose: () => void;
  onAdd: (data: { creancier: string; montantTotal: number; dateEcheance: string | null; notes: string }) => void;
}) {
  const [creancier,    setCreancier]    = useState('');
  const [montant,      setMontant]      = useState('');
  const [dateEcheance, setDateEcheance] = useState('');
  const [notes,        setNotes]        = useState('');

  function reset() { setCreancier(''); setMontant(''); setDateEcheance(''); setNotes(''); }
  function handleClose() { reset(); onClose(); }
  function handleAdd() {
    if (!creancier.trim() || !montant) return;
    onAdd({ creancier: creancier.trim(), montantTotal: +montant, dateEcheance: dateEcheance || null, notes });
    reset();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10000 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 520 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 00-4 0v2"/>
                  <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Nouvelle dette</div>
                <div className="modal-topbar-sub">Enregistrer une créance à rembourser</div>
              </div>
              <motion.button className="modal-close-btn" onClick={handleClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </motion.button>
            </div>
            <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
                    <circle cx="12" cy="12" r="1"/>
                  </svg>
                  <span className="modal-section-label">Informations</span>
                </div>
                <div className="modal-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="field">
                    <label>Créancier <span className="req">*</span></label>
                    <input type="text" placeholder="ex : Banque, fournisseur, particulier…"
                      value={creancier} onChange={(e) => setCreancier(e.target.value)} autoFocus />
                  </div>
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>Montant total (TND) <span className="req">*</span></label>
                      <input type="number" min="0" step="0.001" placeholder="0.000"
                        value={montant} onChange={(e) => setMontant(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Date d&apos;échéance</label>
                      <DatePicker value={dateEcheance} onChange={setDateEcheance} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                  <span className="modal-section-label">Notes</span>
                </div>
                <div className="modal-section-body">
                  <div className="field">
                    <textarea placeholder="Informations complémentaires, conditions de remboursement…"
                      value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                      style={{ resize: 'vertical', width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={handleClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={handleAdd} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}>
                Ajouter la dette
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Confirm delete modal ── */
function ConfirmDeleteModal({ open, creancier, onClose, onConfirm }: {
  open: boolean; creancier: string; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10000 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 420 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon" style={{ background: 'rgba(220,38,38,0.08)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Archiver la dette</div>
                <div className="modal-topbar-sub">{creancier}</div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </motion.button>
            </div>
            <div className="modal-scroll-body">
              <div style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                Cette dette sera <strong>archivée</strong> et conservée dans l&apos;historique.
              </div>
            </div>
            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={() => { onConfirm(); onClose(); }} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                style={{ background: '#dc2626', filter: 'drop-shadow(0px 4px 10px rgba(220,38,38,0.3))', width: 'auto', padding: '11px 24px', whiteSpace: 'nowrap' }}>
                Archiver
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Pay modal ── */
function PayModal({ open, creancier, remaining, onClose, onPay }: {
  open: boolean; creancier: string; remaining: number; onClose: () => void;
  onPay: (montant: number, dateISO: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [montant, setMontant] = useState('');
  const [date,    setDate]    = useState(today);

  function handleClose() { setMontant(''); setDate(today); onClose(); }
  function handlePay() {
    const val = parseFloat(montant);
    if (!val || val <= 0) return;
    onPay(val, date);
    setMontant(''); setDate(today);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10000 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 440 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M9 11l3 3 4-4"/><rect x="3" y="4" width="18" height="18" rx="2"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Paiement — {creancier}</div>
                <div className="modal-topbar-sub">Restant : {fmt(remaining)} TND</div>
              </div>
              <motion.button className="modal-close-btn" onClick={handleClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </motion.button>
            </div>
            <div className="modal-scroll-body">
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
                    <circle cx="12" cy="12" r="1"/>
                  </svg>
                  <span className="modal-section-label">Détails du paiement</span>
                </div>
                <div className="modal-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>Montant (TND) <span className="req">*</span></label>
                      <input type="number" min="0" max={remaining} step="0.001" placeholder="0.000"
                        value={montant} onChange={(e) => setMontant(e.target.value)} autoFocus />
                    </div>
                    <div className="field">
                      <label>Date de paiement</label>
                      <DatePicker value={date} onChange={setDate} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={handleClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={handlePay} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                style={{ background: '#16a34a', filter: 'drop-shadow(0px 4px 10px rgba(22,163,74,0.35))', width: 'auto', padding: '11px 24px', whiteSpace: 'nowrap' }}>
                Confirmer le paiement
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Main page ── */
export default function Dettes() {
  const { dettes, archivedDettes, totalDette, totalPaye, totalRestant, loading, addDette, removeDette, addPaiement } = useDettes();
  const { mois: _mois } = useMoisCourant(); // consumed so context is used

  const [showAddModal, setShowAddModal] = useState(false);
  const [payingId,     setPayingId]     = useState<string | null>(null);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [archiveOpen,  setArchiveOpen]  = useState(false);

  const payingDette   = dettes.find((d) => d.id === payingId)   ?? null;
  const deletingDette = dettes.find((d) => d.id === deletingId) ?? null;

  return (
    <>
      {/* Stats */}
      <motion.div className="dec-stats" initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}>
        {[
          <div className="dec-stat" key="total">
            <div className="dec-stat-label">Total dettes</div>
            <div className="dec-stat-value">{fmt(totalDette)} TND</div>
          </div>,
          <div className="dec-stat dec-stat--green" key="paye">
            <div className="dec-stat-label">Total payé</div>
            <div className="dec-stat-value">{fmt(totalPaye)} TND</div>
          </div>,
          <div className="dec-stat dec-stat--red" key="restant">
            <div className="dec-stat-label">Restant</div>
            <div className="dec-stat-value">{fmt(totalRestant)} TND</div>
          </div>,
          <div className="dec-stat" key="count">
            <div className="dec-stat-label">Nombre</div>
            <div className="dec-stat-value">{dettes.length}</div>
          </div>,
        ].map((child, i) => (
          <motion.div key={i} variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } } }}>
            {child}
          </motion.div>
        ))}
      </motion.div>

      {/* Toolbar */}
      <motion.div className="dec-toolbar" style={{ justifyContent: 'space-between' }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: EASE_OUT, delay: 0.15 }}>
        <div className="sal-month-banner" style={{ margin: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 14, height: 14 }}>
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 00-4 0v2"/>
          </svg>
          Dettes
        </div>
        <motion.button className="btn-add-client" onClick={() => setShowAddModal(true)} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter une dette
        </motion.button>
      </motion.div>

      {/* Modals */}
      <AddDetteModal open={showAddModal} onClose={() => setShowAddModal(false)}
        onAdd={(data) => { addDette(data); setShowAddModal(false); }} />
      <PayModal open={payingId !== null} creancier={payingDette?.creancier ?? ''}
        remaining={payingDette ? payingDette.montantTotal - payingDette.montantPaye : 0}
        onClose={() => setPayingId(null)}
        onPay={(m, d) => { if (payingId) { addPaiement(payingId, m, d); setPayingId(null); } }} />
      <ConfirmDeleteModal open={deletingId !== null} creancier={deletingDette?.creancier ?? ''}
        onClose={() => setDeletingId(null)} onConfirm={() => { if (deletingId) removeDette(deletingId); setDeletingId(null); }} />

      {/* Dettes list */}
      <motion.div className="dec-card"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.2 }}>
        <div className="dec-card-title">Suivi des dettes</div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>Chargement…</div>
        ) : dettes.length === 0 ? (
          <motion.div className="dec-empty" style={{ padding: '24px 0' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <p>Aucune dette</p>
            <span>Ajoutez une dette pour commencer le suivi.</span>
          </motion.div>
        ) : dettes.map((d, rowIdx) => {
          const remaining = +(d.montantTotal - d.montantPaye).toFixed(3);
          const pct       = d.montantTotal > 0 ? Math.min(100, (d.montantPaye / d.montantTotal) * 100) : 0;
          const settled   = remaining <= 0;

          return (
            <div key={d.id} style={{ opacity: settled ? 0.65 : 1 }}>
              <motion.div className="dec-charge-row"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.24, ease: EASE_OUT, delay: 0.22 + rowIdx * 0.06 }}>
                <div className="dec-charge-label">
                  {d.creancier}
                  {settled && <span className="dec-badge dec-badge--green" style={{ marginLeft: 8 }}>Soldée</span>}
                  {d.notes && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginTop: 2 }}>{d.notes}</div>}
                </div>
                <div className="dec-charge-due">
                  {d.dateEcheance ? `Éch. ${new Date(d.dateEcheance).toLocaleDateString('fr-FR')}` : '—'}
                </div>
                <div className="dec-charge-montant">
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(d.montantTotal)} TND</span>
                  <span style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: 10, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                    <span style={{ color: '#16a34a' }}>Payé {fmt(d.montantPaye)}</span>
                    {!settled && <span style={{ color: '#ef4444' }}>Reste {fmt(remaining)}</span>}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                    <div className="dec-progress" style={{ flex: 1 }}>
                      <div className="dec-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
                {!settled && (
                  <button className="dec-btn dec-btn--green dec-btn--sm" onClick={() => setPayingId(d.id)}>Payer</button>
                )}
                <button className="dec-btn dec-btn--sm" title="Archiver" onClick={() => setDeletingId(d.id)}
                  style={{ padding: '4px 8px', color: 'var(--muted)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              </motion.div>

              {d.paiements.length > 0 && (
                <div style={{ padding: '6px 16px 10px', borderBottom: '1px solid var(--border-light, var(--border))' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 5 }}>Historique</div>
                  {d.paiements.map((p, pi) => (
                    <motion.div key={p.id}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '2px 0', color: 'var(--muted)' }}
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, ease: EASE_OUT, delay: 0.25 + rowIdx * 0.06 + pi * 0.04 }}>
                      <span>{Array.isArray(p.date)
                        ? new Date(p.date[0], p.date[1] - 1, p.date[2]).toLocaleDateString('fr-FR')
                        : new Date(p.date).toLocaleDateString('fr-FR')}</span>
                      <span style={{ fontWeight: 600, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.montant)} TND</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* Archived dettes */}
      {archivedDettes.length > 0 && (
        <motion.div className="dec-card"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.35 }}>
          <div className="dec-card-title"
            style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            onClick={() => setArchiveOpen((o) => !o)}>
            <span>Dettes archivées ({archivedDettes.length})</span>
            <motion.svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              style={{ width: 16, height: 16, color: 'var(--muted)', flexShrink: 0 }}
              animate={{ rotate: archiveOpen ? 180 : 0 }} transition={{ duration: 0.22 }}>
              <polyline points="6 9 12 15 18 9"/>
            </motion.svg>
          </div>

          <AnimatePresence initial={false}>
            {archiveOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}>
                {archivedDettes.map((d, rowIdx) => {
                  const pct = d.montantTotal > 0 ? Math.min(100, (d.montantPaye / d.montantTotal) * 100) : 0;
                  const archivedDate = d.archivedAt ? new Date(d.archivedAt).toLocaleDateString('fr-FR') : '';
                  return (
                    <motion.div key={d.id} className="dec-charge-row" style={{ opacity: 0.5 }}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 0.5, x: 0 }}
                      transition={{ duration: 0.22, ease: EASE_OUT, delay: rowIdx * 0.05 }}>
                      <div className="dec-charge-label">
                        {d.creancier}
                        <span className="dec-badge" style={{ marginLeft: 8, background: 'rgba(120,120,120,0.12)', color: 'var(--muted)' }}>Archivée</span>
                        {d.notes && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--faint)', marginTop: 2 }}>{d.notes}</div>}
                      </div>
                      <div className="dec-charge-due" style={{ fontSize: 11, color: 'var(--faint)' }}>
                        {archivedDate ? `Archivée le ${archivedDate}` : ''}
                      </div>
                      <div className="dec-charge-montant">
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(d.montantTotal)} TND</span>
                        <span style={{ display: 'flex', gap: 10, marginTop: 3, fontSize: 10, color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
                          <span>Payé {fmt(d.montantPaye)}</span>
                          <span>Reste {fmt(+(d.montantTotal - d.montantPaye).toFixed(3))}</span>
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                          <div className="dec-progress" style={{ flex: 1 }}>
                            <div className="dec-progress-fill" style={{ width: `${pct}%`, background: 'var(--muted)' }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--faint)', flexShrink: 0 }}>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}
