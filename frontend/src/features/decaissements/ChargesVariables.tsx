import { useState, useEffect, useCallback, useMemo } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { CustomSelect } from '@/components/ui/custom-select';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT } from '@/lib/framer-motion-constants';
import { useMoisCourant } from './MoisContext';
import api from '@/lib/api';
import '@/features/clients/clients.css';
import './decaissements.css';

/* ── Types ── */
type ChargeVariableCategory = 'fournitures' | 'transport' | 'marketing' | 'maintenance' | 'autre';

interface ChargeVariable {
  id: string;
  mois: string;
  label: string;
  montant: number;
  tvaTaux: number;
  date: string;
  categorie: ChargeVariableCategory;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

const CAT_LABELS: Record<ChargeVariableCategory, string> = {
  fournitures: 'Fournitures',
  transport:   'Transport',
  marketing:   'Marketing',
  maintenance: 'Maintenance',
  autre:       'Autre',
};

const CAT_COLORS: Record<ChargeVariableCategory, string> = {
  fournitures: 'blue',
  transport:   'amber',
  marketing:   'green',
  maintenance: 'red',
  autre:       'gray',
};

const BADGE_STYLES: Record<string, React.CSSProperties> = {
  blue:   { background: 'rgba(59,130,246,0.1)',  color: '#3b82f6' },
  amber:  { background: 'rgba(245,158,11,0.1)',  color: '#d97706' },
  green:  { background: 'rgba(22,163,74,0.1)',   color: '#16a34a' },
  red:    { background: 'rgba(220,38,38,0.1)',   color: '#dc2626' },
  gray:   { background: 'rgba(107,114,128,0.1)', color: '#6b7280' },
};

/* ── Hook ── */
function useChargesVariables(mois: string) {
  const [charges, setCharges] = useState<ChargeVariable[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ChargeVariable[]>('/api/charges/variables', { params: { mois } });
      setCharges((data ?? []).sort((a, b) => b.date.localeCompare(a.date)));
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [mois]);

  useEffect(() => { load(); }, [load]);

  const addCharge = useCallback(async (partial: {
    label: string; montant: number; tvaTaux: number; date: string;
    categorie: ChargeVariableCategory; description: string;
  }) => {
    try {
      const { data } = await api.post<ChargeVariable>('/api/charges/variables', { ...partial, mois });
      if (data) setCharges((prev) => [data, ...prev]);
    } catch { /* ignore */ }
  }, [mois]);

  const updateCharge = useCallback(async (id: string, updates: {
    label: string; montant: number; tvaTaux: number; date: string;
    categorie: ChargeVariableCategory; description: string;
  }) => {
    setCharges((prev) => prev.map((c) => c.id === id ? { ...c, ...updates } : c));
    try { await api.put(`/api/charges/variables/${id}`, { ...updates, mois }); }
    catch { load(); }
  }, [load]);

  const removeCharge = useCallback(async (id: string) => {
    setCharges((prev) => prev.filter((c) => c.id !== id));
    try { await api.delete(`/api/charges/variables/${id}`); }
    catch { load(); }
  }, [load]);

  const total   = useMemo(() => charges.reduce((s, c) => s + c.montant, 0), [charges]);
  const totalHT = useMemo(() => charges.reduce((s, c) => {
    const ht = c.tvaTaux > 0 ? c.montant / (1 + c.tvaTaux / 100) : c.montant;
    return s + ht;
  }, 0), [charges]);
  const hasTVA  = useMemo(() => charges.some((c) => c.tvaTaux > 0), [charges]);

  return { charges, loading, total, totalHT: +totalHT.toFixed(3), hasTVA, addCharge, updateCharge, removeCharge };
}

/* ── Add / Edit modal ── */
function ChargeVarModal({ open, charge, mois, onClose, onSave }: {
  open: boolean; charge: ChargeVariable | null; mois: string;
  onClose: () => void;
  onSave: (data: { label: string; montant: number; tvaTaux: number; date: string; categorie: ChargeVariableCategory; description: string }) => void;
}) {
  const isEdit = charge !== null;
  const [label,       setLabel]       = useState('');
  const [montant,     setMontant]     = useState('');
  const [tvaTaux,     setTvaTaux]     = useState('');
  const [date,        setDate]        = useState(`${mois}-01`);
  const [categorie,   setCategorie]   = useState<ChargeVariableCategory>('autre');
  const [description, setDescription] = useState('');

  // Sync form on open for edit
  const [synced, setSynced] = useState(false);
  if (open && !synced && isEdit) {
    setLabel(charge.label);
    setMontant(String(charge.montant));
    setTvaTaux(charge.tvaTaux > 0 ? String(charge.tvaTaux) : '');
    setDate(charge.date.slice(0, 10));
    setCategorie(charge.categorie);
    setDescription(charge.description);
    setSynced(true);
  }
  if (!open && synced) setSynced(false);

  function reset() {
    setLabel(''); setMontant(''); setTvaTaux(''); setDate(`${mois}-01`); setCategorie('autre'); setDescription('');
    setSynced(false);
  }
  function handleClose() { reset(); onClose(); }
  function handleSave() {
    if (!label.trim()) return;
    onSave({ label: label.trim(), montant: +montant || 0, tvaTaux: +tvaTaux || 0, date, categorie, description: description.trim() });
    reset();
  }

  const ttc    = +montant || 0;
  const taux   = +tvaTaux || 0;
  const ht     = taux > 0 ? +(ttc / (1 + taux / 100)).toFixed(3) : ttc;
  const tvaAmt = taux > 0 ? +(ttc - ht).toFixed(3) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10000 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 560 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                {isEdit ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                    <polyline points="17 6 23 6 23 12"/>
                  </svg>
                )}
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">{isEdit ? 'Modifier la dépense' : 'Nouvelle dépense variable'}</div>
                <div className="modal-topbar-sub">{isEdit ? charge.label : 'Dépense ponctuelle pour ce mois'}</div>
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
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                  </svg>
                  <span className="modal-section-label">Identification &amp; catégorisation</span>
                </div>
                <div className="modal-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="modal-fields-row">
                    <div className="field" style={{ flex: 2 }}>
                      <label>Libellé <span className="req">*</span></label>
                      <input type="text" placeholder="ex : Achat fournitures, Transport…"
                        value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Catégorie</label>
                      <CustomSelect value={categorie} onChange={(v) => setCategorie(v as ChargeVariableCategory)}
                        options={(Object.keys(CAT_LABELS) as ChargeVariableCategory[]).map((k) => ({ value: k, label: CAT_LABELS[k] }))} />
                    </div>
                  </div>
                  <div className="field">
                    <label>Description <span style={{ fontSize: 10, color: 'var(--faint)', fontWeight: 400 }}>(optionnel)</span></label>
                    <textarea placeholder="Détails supplémentaires…" value={description}
                      onChange={(e) => setDescription(e.target.value)} rows={2}
                      style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                </div>
              </div>

              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                  <span className="modal-section-label">Montant &amp; date</span>
                </div>
                <div className="modal-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>Montant TTC (TND)</label>
                      <input type="number" min="0" step="0.001" placeholder="0.000"
                        value={montant} onChange={(e) => setMontant(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Date de la dépense</label>
                      <DatePicker value={date} onChange={setDate} />
                    </div>
                    <div className="field" style={{ maxWidth: 130 }}>
                      <label>Taux TVA (%)</label>
                      <input type="number" min="0" max="100" step="1" placeholder="ex : 19"
                        value={tvaTaux} onChange={(e) => setTvaTaux(e.target.value)} />
                    </div>
                  </div>
                  {taux > 0 && ttc > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: '12px 16px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--faint)', textTransform: 'uppercase', marginBottom: 4 }}>Montant HT</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                          {ht.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)' }}>TND</span>
                        </div>
                      </div>
                      <div style={{ background: 'rgba(22,163,74,0.07)', borderRadius: 12, padding: '12px 16px', border: '1px solid rgba(22,163,74,0.15)' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#16a34a', textTransform: 'uppercase', marginBottom: 4 }}>TVA récupérable ({taux}%)</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>
                          {tvaAmt.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} <span style={{ fontSize: 11, fontWeight: 500 }}>TND</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--faint)', fontStyle: 'italic' }}>
                      Aucune TVA — la charge sera comptabilisée en totalité.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={handleClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={handleSave} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}>
                {isEdit ? 'Enregistrer' : 'Ajouter la dépense'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Confirm delete modal ── */
function ConfirmDeleteModal({ open, charge, onClose, onConfirm }: {
  open: boolean; charge: ChargeVariable | null; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10001 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 380 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon" style={{ background: 'rgba(220,38,38,0.1)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Supprimer la dépense</div>
                <div className="modal-topbar-sub">{charge?.label ?? ''}</div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </motion.button>
            </div>
            <div style={{ padding: '20px 28px 24px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, textAlign: 'center' }}>
              <strong style={{ color: 'var(--text)' }}>{charge?.label}</strong>{' '}
              sera supprimée définitivement de ce mois.
            </div>
            <div className="modal-action-bar" style={{ justifyContent: 'space-between', paddingLeft: 24, paddingRight: 24 }}>
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button onClick={onConfirm} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                style={{ padding: '11px 28px', borderRadius: 29, border: 'none', background: '#dc2626', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Supprimer
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Main page ── */
export default function ChargesVariables() {
  const { mois, label: moisLabel } = useMoisCourant();
  const { charges, loading, total, totalHT, hasTVA, addCharge, updateCharge, removeCharge } = useChargesVariables(mois);

  const [adding,         setAdding]         = useState(false);
  const [editingCharge,  setEditingCharge]  = useState<ChargeVariable | null>(null);
  const [deletingCharge, setDeletingCharge] = useState<ChargeVariable | null>(null);

  return (
    <>
      {/* Stats */}
      <motion.div className="dec-stats" initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}>
        {[
          <div className="dec-stat" key="total">
            <div className="dec-stat-label">Total du mois</div>
            <div className="dec-stat-value">{fmt(total)} TND</div>
          </div>,
          hasTVA ? (
            <div className="dec-stat dec-stat--green" key="ht">
              <div className="dec-stat-label">Total HT</div>
              <div className="dec-stat-value">{fmt(totalHT)} TND</div>
            </div>
          ) : null,
          <div className="dec-stat" key="count">
            <div className="dec-stat-label">Nombre de dépenses</div>
            <div className="dec-stat-value">{charges.length}</div>
          </div>,
        ].filter(Boolean).map((child, i) => (
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
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
          </svg>
          Charges variables — <strong>{moisLabel}</strong>
        </div>
        <motion.button className="btn-add-client" onClick={() => setAdding(true)} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter une dépense
        </motion.button>
      </motion.div>

      {/* Modals */}
      <ConfirmDeleteModal open={deletingCharge !== null} charge={deletingCharge}
        onClose={() => setDeletingCharge(null)}
        onConfirm={() => { if (deletingCharge) removeCharge(deletingCharge.id); setDeletingCharge(null); }} />
      <ChargeVarModal open={adding} charge={null} mois={mois}
        onClose={() => setAdding(false)}
        onSave={(data) => { addCharge(data); setAdding(false); }} />
      <ChargeVarModal open={editingCharge !== null} charge={editingCharge} mois={mois}
        onClose={() => setEditingCharge(null)}
        onSave={(data) => { if (editingCharge) { updateCharge(editingCharge.id, data); setEditingCharge(null); } }} />

      {/* List */}
      <motion.div className="dec-card"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.2 }}>
        <div className="dec-card-title">Dépenses variables</div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>Chargement…</div>
        ) : charges.length === 0 ? (
          <motion.div className="dec-empty" style={{ padding: '24px 0' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <p>Aucune dépense ce mois</p>
            <span>Ajoutez les dépenses ponctuelles engagées ce mois-ci.</span>
          </motion.div>
        ) : charges.map((c, rowIdx) => {
          const ht     = c.tvaTaux > 0 ? +(c.montant / (1 + c.tvaTaux / 100)).toFixed(3) : null;
          const tvaAmt = ht !== null ? +(c.montant - ht).toFixed(3) : null;
          const col    = CAT_COLORS[c.categorie];
          const badgeStyle = BADGE_STYLES[col] ?? {};
          return (
            <motion.div className="dec-charge-row" key={c.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.24, ease: EASE_OUT, delay: 0.22 + rowIdx * 0.06 }}>
              <div className="dec-charge-label">
                <span>{c.label}</span>
                <span className="dec-badge" style={{ ...badgeStyle, marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 6 }}>
                  {CAT_LABELS[c.categorie]}
                </span>
                {c.description && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)', marginTop: 2 }}>{c.description}</div>}
              </div>
              <div className="dec-charge-due">{new Date(c.date).toLocaleDateString('fr-FR')}</div>
              <div className="dec-charge-montant">
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(c.montant)} TND</span>
                {ht !== null && tvaAmt !== null && (
                  <span style={{ display: 'flex', gap: 6, marginTop: 2, fontSize: 10, color: 'var(--muted)' }}>
                    <span>HT : {fmt(ht)}</span><span>·</span>
                    <span style={{ color: '#16a34a' }}>TVA ({c.tvaTaux}%) : {fmt(tvaAmt)}</span>
                  </span>
                )}
              </div>
              <button className="dec-btn dec-btn--sm" title="Modifier" onClick={() => setEditingCharge(c)}
                style={{ padding: '4px 8px', color: 'var(--muted)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button className="dec-btn dec-btn--sm" title="Supprimer" onClick={() => setDeletingCharge(c)}
                style={{ padding: '4px 8px', color: 'var(--muted)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
            </motion.div>
          );
        })}
      </motion.div>
    </>
  );
}
