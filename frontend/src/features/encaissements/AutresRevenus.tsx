import { useState, useEffect, useCallback, useMemo } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { CustomSelect } from '@/components/ui/custom-select';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { EASE_OUT } from '@/lib/framer-motion-constants';
import { useMoisEnc } from './EncaissementsLayout';
import { api } from '@/lib/api';
import '@/features/clients/clients.css';
import '@/features/decaissements/decaissements.css';

/* ── Types ── */
type AutreRevenuCategorie = 'consulting' | 'vente' | 'subvention' | 'remboursement' | 'loyer' | 'autre';

interface AutreRevenu {
  id: string;
  label: string;
  montant: number;
  tvaTaux: number;
  date: string;
  categorie: AutreRevenuCategorie;
  description: string;
  createdAt: string;
}

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

const CAT_LABELS: Record<AutreRevenuCategorie, string> = {
  consulting:    'Consulting',
  vente:         'Vente',
  subvention:    'Subvention',
  remboursement: 'Remboursement',
  loyer:         'Loyer',
  autre:         'Autre',
};

const CAT_COLORS: Record<AutreRevenuCategorie, string> = {
  consulting:    'blue',
  vente:         'green',
  subvention:    'amber',
  remboursement: 'purple',
  loyer:         'orange',
  autre:         'gray',
};

const BADGE_STYLES: Record<string, React.CSSProperties> = {
  blue:   { background: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  green:  { background: 'rgba(22,163,74,0.1)',   color: '#16a34a' },
  amber:  { background: 'rgba(245,158,11,0.1)',  color: '#d97706' },
  purple: { background: 'rgba(139,92,246,0.1)',  color: '#7c3aed' },
  orange: { background: 'rgba(249,115,22,0.1)',  color: '#ea580c' },
  gray:   { background: 'rgba(107,114,128,0.1)', color: '#6b7280' },
};

/* ── Hook ── */
function useAutresRevenus(moisKey: string) {
  const [revenus,  setRevenus]  = useState<AutreRevenu[]>([]);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = `${moisKey}-01`;
      const [y, m] = moisKey.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const to = `${moisKey}-${String(lastDay).padStart(2, '0')}`;
      const { data } = await api.get<AutreRevenu[]>('/api/autres-revenus', { params: { from, to } });
      setRevenus(data ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [moisKey]);

  useEffect(() => { load(); }, [load]);

  const addRevenu = useCallback(async (data: {
    label: string; montant: number; tvaTaux: number;
    date: string; categorie: AutreRevenuCategorie; description: string;
  }) => {
    try {
      const { data: inserted } = await api.post<AutreRevenu>('/api/autres-revenus', data);
      if (inserted) {
        const entryMonth = inserted.date.slice(0, 7);
        if (entryMonth === moisKey) setRevenus((prev) => [inserted, ...prev]);
      }
    } catch { /* ignore */ }
  }, [moisKey]);

  const removeRevenu = useCallback(async (id: string) => {
    setRevenus((prev) => prev.filter((r) => r.id !== id));
    try { await api.delete(`/api/autres-revenus/${id}`); }
    catch { load(); }
  }, [load]);

  const totalTTC = useMemo(() => revenus.reduce((s, r) => s + r.montant, 0), [revenus]);
  const totalHT  = useMemo(() =>
    revenus.reduce((s, r) => {
      const ht = r.tvaTaux > 0 ? r.montant / (1 + r.tvaTaux / 100) : r.montant;
      return s + ht;
    }, 0),
  [revenus]);
  const totalTVA = +(totalTTC - totalHT).toFixed(3);

  return { revenus, loading, totalTTC, totalHT: +totalHT.toFixed(3), totalTVA, addRevenu, removeRevenu };
}

/* ── Add modal ── */
function AddRevenuModal({ open, defaultDate, onClose, onAdd }: {
  open: boolean; defaultDate: string; onClose: () => void;
  onAdd: (data: { label: string; montant: number; tvaTaux: number; date: string; categorie: AutreRevenuCategorie; description: string }) => void;
}) {
  const [label,       setLabel]       = useState('');
  const [montant,     setMontant]     = useState('');
  const [tvaTaux,     setTvaTaux]     = useState('0');
  const [date,        setDate]        = useState(defaultDate);
  const [categorie,   setCategorie]   = useState<AutreRevenuCategorie>('autre');
  const [description, setDescription] = useState('');

  function reset() { setLabel(''); setMontant(''); setTvaTaux('0'); setDate(defaultDate); setCategorie('autre'); setDescription(''); }
  function handleClose() { reset(); onClose(); }
  function handleAdd() {
    if (!label.trim() || !montant) return;
    onAdd({ label: label.trim(), montant: +montant, tvaTaux: +tvaTaux, date, categorie, description: description.trim() });
    reset();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10000 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 540 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Nouveau revenu</div>
                <div className="modal-topbar-sub">Enregistrer un revenu manuellement</div>
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
                    <label>Libellé <span className="req">*</span></label>
                    <input type="text" placeholder="ex : Prestation client…" value={label}
                      onChange={(e) => setLabel(e.target.value)} autoFocus />
                  </div>
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>Montant TTC (TND) <span className="req">*</span></label>
                      <input type="number" min="0" step="0.001" placeholder="0.000"
                        value={montant} onChange={(e) => setMontant(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>TVA (%)</label>
                      <input type="number" min="0" max="100" step="1" placeholder="0"
                        value={tvaTaux} onChange={(e) => setTvaTaux(e.target.value)} />
                    </div>
                  </div>
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>Date</label>
                      <DatePicker value={date} onChange={setDate} />
                    </div>
                    <div className="field">
                      <label>Catégorie</label>
                      <CustomSelect
                        value={categorie}
                        onChange={(v) => setCategorie(v as AutreRevenuCategorie)}
                        options={(Object.keys(CAT_LABELS) as AutreRevenuCategorie[]).map((k) => ({ value: k, label: CAT_LABELS[k] }))}
                      />
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
                  <span className="modal-section-label">Description</span>
                </div>
                <div className="modal-section-body">
                  <div className="field">
                    <textarea placeholder="Informations complémentaires…" value={description}
                      onChange={(e) => setDescription(e.target.value)} rows={3}
                      style={{ resize: 'vertical', width: '100%' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={handleClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={handleAdd} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}>
                Ajouter le revenu
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Confirm delete modal ── */
function ConfirmDeleteModal({ open, label, onClose, onConfirm }: {
  open: boolean; label: string; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10000 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 400 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon" style={{ background: 'rgba(220,38,38,0.08)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Supprimer le revenu</div>
                <div className="modal-topbar-sub">{label}</div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </motion.button>
            </div>
            <div className="modal-scroll-body">
              <div style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 12, padding: '14px 18px', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                Cette entrée sera <strong>définitivement supprimée</strong>. Cette action est irréversible.
              </div>
            </div>
            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={() => { onConfirm(); onClose(); }} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                style={{ background: '#dc2626', filter: 'drop-shadow(0px 4px 10px rgba(220,38,38,0.3))', width: 'auto', padding: '11px 24px', whiteSpace: 'nowrap' }}>
                Supprimer
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Row variants ── */
const rowVariants: Variants = {
  hidden:  { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.24, ease: EASE_OUT, delay: 0.22 + i * 0.06 },
  }),
};

/* ── Main page ── */
export default function AutresRevenus() {
  const moisKey = useMoisEnc();
  const { revenus, loading, totalTTC, totalHT, totalTVA, addRevenu, removeRevenu } = useAutresRevenus(moisKey);

  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);

  const defaultDate = `${moisKey}-01`;
  const deletingRevenu = revenus.find((r) => r.id === deletingId) ?? null;
  const hasTVA = revenus.some((r) => r.tvaTaux > 0);

  return (
    <>
      {/* Stats */}
      <motion.div className="dec-stats" initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}>
        {[
          <div className="dec-stat dec-stat--green" key="ttc">
            <div className="dec-stat-label">Total encaissé (TTC)</div>
            <div className="dec-stat-value">{fmt(totalTTC)} TND</div>
          </div>,
          ...(hasTVA ? [
            <div className="dec-stat" key="ht">
              <div className="dec-stat-label">Total HT</div>
              <div className="dec-stat-value">{fmt(totalHT)} TND</div>
            </div>,
            <div className="dec-stat" key="tva">
              <div className="dec-stat-label">TVA collectée</div>
              <div className="dec-stat-value">{fmt(totalTVA)} TND</div>
            </div>,
          ] : []),
          <div className="dec-stat" key="count">
            <div className="dec-stat-label">Entrées</div>
            <div className="dec-stat-value">{revenus.length}</div>
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
        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}>
        <div className="sal-month-banner" style={{ margin: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 14, height: 14 }}>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
          Autres revenus
        </div>
        <motion.button className="btn-add-client" onClick={() => setShowAddModal(true)} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter un revenu
        </motion.button>
      </motion.div>

      {/* Modals */}
      <AddRevenuModal open={showAddModal} defaultDate={defaultDate} onClose={() => setShowAddModal(false)}
        onAdd={(data) => { addRevenu(data); setShowAddModal(false); }} />
      <ConfirmDeleteModal open={deletingId !== null} label={deletingRevenu?.label ?? ''}
        onClose={() => setDeletingId(null)}
        onConfirm={() => { if (deletingId) removeRevenu(deletingId); setDeletingId(null); }} />

      {/* List */}
      <motion.div className="dec-card"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}>
        <div className="dec-card-title">Revenus du mois</div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>Chargement…</div>
        ) : revenus.length === 0 ? (
          <motion.div className="dec-empty" style={{ padding: '24px 0' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <p>Aucun revenu ce mois</p>
            <span>Ajoutez un revenu manuel pour commencer.</span>
          </motion.div>
        ) : (
          revenus.map((r, rowIdx) => {
            const color = CAT_COLORS[r.categorie];
            const badgeStyle = BADGE_STYLES[color];
            const htVal = r.tvaTaux > 0 ? r.montant / (1 + r.tvaTaux / 100) : null;
            return (
              <motion.div key={r.id} className="dec-charge-row"
                custom={rowIdx} variants={rowVariants} initial="hidden" animate="visible">
                <div className="dec-charge-label">
                  <span>{r.label}</span>
                  <span className="dec-badge" style={{ ...badgeStyle, marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 6 }}>
                    {CAT_LABELS[r.categorie]}
                  </span>
                  {r.description && (
                    <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginTop: 2 }}>{r.description}</div>
                  )}
                </div>
                <div className="dec-charge-due">{new Date(r.date).toLocaleDateString('fr-FR')}</div>
                <div className="dec-charge-montant">
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(r.montant)} TND</span>
                  {htVal !== null && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, display: 'block', fontVariantNumeric: 'tabular-nums' }}>
                      HT {fmt(htVal)} · TVA {r.tvaTaux}%
                    </span>
                  )}
                </div>
                <button className="dec-btn dec-btn--sm" title="Supprimer" onClick={() => setDeletingId(r.id)}
                  style={{ padding: '4px 8px', color: 'var(--muted)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </>
  );
}
