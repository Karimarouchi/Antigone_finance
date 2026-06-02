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
type ChargeFixeCycle = 1 | 3 | 6 | 12 | 24 | 48;

interface ChargeFixeDef {
  id: string;
  groupId: string;
  label: string;
  montant: number;
  tvaTaux: number;
  jourEcheance: number;
  cycleMonths: ChargeFixeCycle;
  createdAt: string;
  archivedAt: string | null;
}

interface ChargeFixePaiement {
  id: string;
  chargeId: string;
  mois: string;
  montant: number;
  datePaiement: string;
  createdAt: string;
}

interface MoisImpaye {
  moisKey: string;
  label: string;
  chargeId: string;
  montantDu: number;
  montantPaye: number;
  resteAPayer: number;
}

interface ChargeFixe extends ChargeFixeDef {
  status: 'payee' | 'partielle' | 'non-payee';
  montantPaye: number;
  resteAPayer: number;
  moisImpayes: MoisImpaye[];
  cumulImpaye: number;
  historique: ChargeFixePaiement[];
}

/* ── Helpers ── */
const CYCLE_OPTIONS: { value: string; label: string }[] = [
  { value: '1',  label: 'Mensuel' },
  { value: '3',  label: 'Trimestriel' },
  { value: '6',  label: 'Semestriel' },
  { value: '12', label: 'Annuel' },
  { value: '24', label: 'Tous les 2 ans' },
  { value: '48', label: 'Tous les 4 ans' },
];

function cycleLabel(c: number): string {
  return CYCLE_OPTIONS.find((o) => +o.value === c)?.label ?? 'Mensuel';
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

const FR_MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function moisLabel(mois: string): string {
  const [y, m] = mois.split('-').map(Number);
  return `${FR_MONTHS[m - 1]} ${y}`;
}

function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

function addMonths(mois: string, n: number): string {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentMoisStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toIsoStr(v: string | number | number[] | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return new Date(v[0], v[1] - 1, v[2]).toISOString();
  const ms = (v as number) < 1e12 ? (v as number) * 1000 : (v as number);
  return new Date(ms).toISOString();
}

function isDueInMonth(def: ChargeFixeDef, mois: string): boolean {
  const anchorMois = def.createdAt.slice(0, 7);
  if (mois < anchorMois) return false;
  if (def.archivedAt && def.archivedAt.slice(0, 7) <= mois) return false;
  return monthsBetween(anchorMois, mois) % def.cycleMonths === 0;
}

/* ── Hook ── */
function useChargesFixes(viewingMois: string) {
  const [defs,      setDefs]      = useState<ChargeFixeDef[]>([]);
  const [paiements, setPaiements] = useState<ChargeFixePaiement[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const defsRes = await api.get<ChargeFixeDef[]>('/api/charges/fixes');
      const allDefs = (defsRes.data ?? []).map((d) => ({
        ...d,
        createdAt:  toIsoStr((d as any).createdAt)  ?? String(d.createdAt),
        archivedAt: d.archivedAt != null ? (toIsoStr((d as any).archivedAt) ?? String(d.archivedAt)) : null,
      })) as ChargeFixeDef[];
      setDefs(allDefs);
      // Fetch paiements for each charge concurrently
      const results = await Promise.all(
        allDefs.map((d) =>
          api.get<ChargeFixePaiement[]>(`/api/charges/fixes/${d.id}/paiements`)
            .then((r) => (r.data ?? []).map((p) => ({
              ...p,
              datePaiement: toIsoStr((p as any).datePaiement) ?? String(p.datePaiement),
              createdAt:    toIsoStr((p as any).createdAt)    ?? String(p.createdAt),
            })) as ChargeFixePaiement[])
            .catch(() => [] as ChargeFixePaiement[])
        )
      );
      setPaiements(results.flat());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const charges = useMemo((): ChargeFixe[] => {
    const now = currentMoisStr();
    return defs
      .filter((def) => isDueInMonth(def, viewingMois))
      .map((def) => {
        // Paiements for current viewing month
        const moisPaies  = paiements.filter((p) => p.chargeId === def.id && p.mois === viewingMois);
        const montantPaye = +moisPaies.reduce((s, p) => s + p.montant, 0).toFixed(3);
        const resteAPayer = +Math.max(0, def.montant - montantPaye).toFixed(3);
        const status: ChargeFixe['status'] =
          resteAPayer <= 0 ? 'payee' : montantPaye > 0 ? 'partielle' : 'non-payee';

        // Compute past unpaid months
        const moisImpayes: MoisImpaye[] = [];
        const anchorMois = def.createdAt.slice(0, 7);
        let m = anchorMois;
        while (m < viewingMois && m < now) {
          if (monthsBetween(anchorMois, m) % def.cycleMonths === 0) {
            const paid = +paiements.filter((p) => p.chargeId === def.id && p.mois === m).reduce((s, p) => s + p.montant, 0).toFixed(3);
            const reste = +Math.max(0, def.montant - paid).toFixed(3);
            if (reste > 0) {
              moisImpayes.push({ moisKey: m, label: moisLabel(m), chargeId: def.id, montantDu: def.montant, montantPaye: paid, resteAPayer: reste });
            }
          }
          m = addMonths(m, 1);
        }

        const cumulImpaye = +moisImpayes.reduce((s, mi) => s + mi.resteAPayer, 0).toFixed(3);

        // Historique = all paiements for this charge
        const historique = paiements.filter((p) => p.chargeId === def.id && p.mois === viewingMois);

        return { ...def, status, montantPaye, resteAPayer, moisImpayes, cumulImpaye, historique };
      });
  }, [defs, paiements, viewingMois]);

  const totalMensuel  = useMemo(() => charges.reduce((s, c) => s + c.montant, 0), [charges]);
  const totalImpayes  = useMemo(() => charges.reduce((s, c) => s + (c.status !== 'payee' ? c.resteAPayer : 0), 0), [charges]);
  const overdueCount  = useMemo(() => {
    const day = new Date().getDate();
    return charges.filter((c) => c.status !== 'payee' && day > c.jourEcheance).length;
  }, [charges]);

  const archivedDefs = useMemo(() => defs.filter((d) => d.archivedAt), [defs]);
  const findMergeCandidate = useCallback((label: string) => {
    const normalise = (s: string) => s.trim().toLowerCase();
    return archivedDefs.find((d) => normalise(d.label) === normalise(label)) ?? null;
  }, [archivedDefs]);

  const addCharge = useCallback(async (data: {
    label: string; montant: number; tvaTaux: number; jourEcheance: number; cycleMonths: ChargeFixeCycle;
  }, existingGroupId?: string) => {
    try {
      const { data: inserted } = await api.post<ChargeFixeDef>('/api/charges/fixes', { ...data, groupId: existingGroupId });
      if (inserted) setDefs((prev) => [...prev, {
        ...inserted,
        createdAt:  toIsoStr((inserted as any).createdAt)  ?? String(inserted.createdAt),
        archivedAt: inserted.archivedAt != null ? (toIsoStr((inserted as any).archivedAt) ?? String(inserted.archivedAt)) : null,
      }]);
      return undefined;
    } catch (err: any) {
      return err?.response?.data?.message ?? 'Erreur lors de la création.';
    }
  }, []);

  const updateCharge = useCallback(async (id: string, data: {
    label: string; montant: number; tvaTaux: number; jourEcheance: number; cycleMonths: ChargeFixeCycle;
  }) => {
    setDefs((prev) => prev.map((d) => d.id === id ? { ...d, ...data } : d));
    try {
      await api.put(`/api/charges/fixes/${id}`, data);
      return undefined;
    } catch {
      load();
      return 'Erreur lors de la modification.';
    }
  }, [load]);

  const removeCharge = useCallback(async (id: string) => {
    setDefs((prev) => prev.filter((d) => d.id !== id));
    try { await api.delete(`/api/charges/fixes/${id}`); }
    catch { load(); }
  }, [load]);

  const marquerPayee = useCallback(async (chargeId: string, moisCible: string, montant: number, dateISO: string) => {
    try {
      const datePart = dateISO.slice(0, 10);
      const { data: pRaw } = await api.post<ChargeFixePaiement>(`/api/charges/fixes/${chargeId}/paiements`, {
        mois: moisCible, montant, datePaiement: datePart + 'T00:00:00Z',
      });
      if (pRaw) {
        const p: ChargeFixePaiement = {
          ...pRaw,
          datePaiement: toIsoStr((pRaw as any).datePaiement) ?? String(pRaw.datePaiement),
          createdAt:    toIsoStr((pRaw as any).createdAt)    ?? String(pRaw.createdAt),
        };
        setPaiements((prev) => [...prev.filter((pp) => pp.id !== p.id), p]);
      }
    } catch { load(); }
  }, [load]);

  return { charges, loading, totalMensuel, totalImpayes, overdueCount, findMergeCandidate, addCharge, updateCharge, removeCharge, marquerPayee };
}

/* ── ChargeModal ── */
function ChargeModal({ open, charge, onClose, onSave }: {
  open: boolean; charge: ChargeFixe | null; onClose: () => void;
  onSave: (data: { label: string; montant: number; tvaTaux: number; jourEcheance: number; cycleMonths: ChargeFixeCycle; date: string }) => Promise<string | undefined>;
}) {
  const isEdit = charge !== null;
  const [label,    setLabel]    = useState('');
  const [montant,  setMontant]  = useState('');
  const [tvaTaux,  setTvaTaux]  = useState('');
  const [jour,     setJour]     = useState('1');
  const [cycle,    setCycle]    = useState<string>('');
  const [date,     setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [saveError, setSaveError] = useState<string | null>(null);

  const [synced, setSynced] = useState(false);
  if (open && !synced && isEdit) {
    setLabel(charge.label);
    setMontant(String(charge.montant));
    setTvaTaux(charge.tvaTaux > 0 ? String(charge.tvaTaux) : '');
    setJour(String(charge.jourEcheance));
    setCycle(String(charge.cycleMonths));
    setSynced(true);
  }
  if (!open && synced) setSynced(false);

  function handleClose() {
    setLabel(''); setMontant(''); setTvaTaux(''); setJour('1'); setCycle(''); setSaveError(null);
    setDate(new Date().toISOString().slice(0, 10)); setSynced(false); onClose();
  }

  async function handleSave() {
    if (!label.trim()) { setSaveError('Le libellé est obligatoire.'); return; }
    if (!(+montant > 0)) { setSaveError('Le montant TTC est obligatoire.'); return; }
    if (!cycle) { setSaveError('La périodicité est obligatoire.'); return; }
    setSaveError(null);
    const err = await onSave({ label: label.trim(), montant: +montant, tvaTaux: +tvaTaux || 0, jourEcheance: +jour || 1, cycleMonths: +cycle as ChargeFixeCycle, date });
    if (err) { setSaveError(err); }
    else { setLabel(''); setMontant(''); setTvaTaux(''); setJour('1'); setCycle(''); setSaveError(null); setDate(new Date().toISOString().slice(0, 10)); setSynced(false); }
  }

  const ttc = +montant || 0; const taux = +tvaTaux || 0;
  const ht = taux > 0 ? +(ttc / (1 + taux / 100)).toFixed(3) : ttc;
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
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                )}
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">{isEdit ? 'Modifier la charge' : 'Nouvelle charge fixe'}</div>
                <div className="modal-topbar-sub">{isEdit ? charge.label : 'Charge récurrente prélevée chaque mois'}</div>
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
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  <span className="modal-section-label">Identification &amp; planification</span>
                </div>
                <div className="modal-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field">
                    <label>Libellé <span className="req">*</span></label>
                    <input type="text" placeholder="ex: Loyer, Nettoyage, Crédit…" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
                  </div>
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>Montant TTC (TND) <span className="req">*</span></label>
                      <input type="number" min="0" step="0.001" placeholder="0.000" value={montant} onChange={(e) => setMontant(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Jour d&apos;échéance</label>
                      <input type="number" min="1" max="28" placeholder="1" value={jour} onChange={(e) => setJour(e.target.value)} />
                    </div>
                  </div>
                  {!isEdit && (
                    <div className="field" style={{ maxWidth: 220 }}>
                      <label>Date d&apos;ajout</label>
                      <DatePicker value={date} onChange={setDate} />
                    </div>
                  )}
                  <div className="field">
                    <label>Périodicité <span className="req">*</span></label>
                    <CustomSelect value={cycle} onChange={setCycle} options={CYCLE_OPTIONS} placeholder="Sélectionner…" />
                    {cycle && (
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        {+cycle === 1 ? 'Prélevée chaque mois.' : `Prélevée tous les ${cycle} mois à partir de ce mois-ci.`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                  </svg>
                  <span className="modal-section-label">TVA déductible</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--faint)', fontWeight: 500 }}>Optionnel — le montant saisi est TTC</span>
                </div>
                <div className="modal-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field" style={{ maxWidth: 180 }}>
                    <label>Taux TVA (%)</label>
                    <input type="number" min="0" max="100" step="1" placeholder="ex : 19" value={tvaTaux} onChange={(e) => setTvaTaux(e.target.value)} />
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
                    <div style={{ fontSize: 12, color: 'var(--faint)', fontStyle: 'italic' }}>Aucune TVA — la charge sera comptabilisée en totalité.</div>
                  )}
                </div>
              </div>
            </div>

            {saveError && (
              <div style={{ margin: '0 24px 4px', padding: '10px 14px', borderRadius: 10, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', fontSize: 13, color: '#dc2626', fontWeight: 500 }}>
                {saveError}
              </div>
            )}

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={handleClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={handleSave} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}>
                {isEdit ? 'Enregistrer' : 'Ajouter la charge'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Payment modal ── */
function PaymentModal({ open, charge, mois: viewingMois, moisLabel: viewingMoisLabel, onClose, onPay }: {
  open: boolean; charge: ChargeFixe | null; mois: string; moisLabel: string;
  onClose: () => void;
  onPay: (payments: { chargeId: string; moisCible: string; montant: number; dateISO: string }[]) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [selections, setSelections] = useState<Record<string, { checked: boolean; amount: string }>>({});

  const allItems = useMemo((): (MoisImpaye & { isCurrent: boolean })[] => {
    if (!charge) return [];
    const items: (MoisImpaye & { isCurrent: boolean })[] = charge.moisImpayes.map((mi) => ({ ...mi, isCurrent: false }));
    if (charge.resteAPayer > 0) {
      items.push({ moisKey: viewingMois, label: viewingMoisLabel, chargeId: charge.id, montantDu: charge.montant, montantPaye: charge.montantPaye, resteAPayer: charge.resteAPayer, isCurrent: true });
    }
    return items;
  }, [charge, viewingMois, viewingMoisLabel]);

  useEffect(() => {
    if (!open || !charge) return;
    const init: Record<string, { checked: boolean; amount: string }> = {};
    allItems.forEach((item) => { init[item.moisKey] = { checked: true, amount: item.resteAPayer.toFixed(3) }; });
    setSelections(init);
    setDate(new Date().toISOString().slice(0, 10));
  }, [open, charge?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = allItems.reduce((s, item) => {
    const sel = selections[item.moisKey];
    return s + (sel?.checked ? parseFloat(sel.amount) || 0 : 0);
  }, 0);

  const allChecked = allItems.every((item) => selections[item.moisKey]?.checked);

  function toggleAll() {
    const next = !allChecked;
    setSelections((prev) => {
      const updated = { ...prev };
      allItems.forEach((item) => { updated[item.moisKey] = { ...updated[item.moisKey], checked: next }; });
      return updated;
    });
  }

  function handleConfirm() {
    const payments = allItems
      .map((item) => {
        const sel = selections[item.moisKey];
        if (!sel?.checked) return null;
        const montant = parseFloat(sel.amount) || 0;
        if (montant <= 0) return null;
        return { chargeId: item.chargeId, moisCible: item.moisKey, montant, dateISO: date || new Date().toISOString() };
      })
      .filter(Boolean) as { chargeId: string; moisCible: string; montant: number; dateISO: string }[];
    if (payments.length > 0) onPay(payments);
    onClose();
  }

  return (
    <AnimatePresence>
      {open && charge && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10001 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 580 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
                </svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Paiement — {charge.label}</div>
                <div className="modal-topbar-sub">
                  {allItems.length} mois à régler · total : {fmt(allItems.reduce((s, m) => s + m.resteAPayer, 0))} TND
                </div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </motion.button>
            </div>

            <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span className="modal-section-label">Mois à payer</span>
                  </div>
                  {allItems.length > 1 && (
                    <button onClick={toggleAll}
                      style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                      {allChecked ? 'Tout décocher' : 'Tout cocher'}
                    </button>
                  )}
                </div>
                <div className="modal-section-body" style={{ padding: 0 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 90px 90px 110px', gap: 10, padding: '8px 18px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--faint)', textTransform: 'uppercase' }}>
                    <span/><span>Mois</span>
                    <span style={{ textAlign: 'right' }}>Dû</span>
                    <span style={{ textAlign: 'right' }}>Payé</span>
                    <span style={{ textAlign: 'right' }}>Montant</span>
                  </div>
                  {allItems.map((item, i) => {
                    const sel = selections[item.moisKey] ?? { checked: true, amount: item.resteAPayer.toFixed(3) };
                    const isLast = i === allItems.length - 1;
                    return (
                      <div key={item.moisKey}
                        style={{ display: 'grid', gridTemplateColumns: '24px 1fr 90px 90px 110px', gap: 10, alignItems: 'center', padding: '10px 18px', borderBottom: isLast ? 'none' : '1px solid var(--border)', background: item.isCurrent ? 'rgba(99,102,241,0.04)' : 'transparent', opacity: sel.checked ? 1 : 0.45, transition: 'opacity 0.15s' }}>
                        <input type="checkbox" checked={sel.checked}
                          onChange={(e) => setSelections((prev) => ({ ...prev, [item.moisKey]: { ...sel, checked: e.target.checked } }))}
                          style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13, color: item.isCurrent ? 'var(--accent)' : 'var(--text)' }}>{item.label}</span>
                          {item.isCurrent && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'rgba(99,102,241,0.12)', borderRadius: 4, padding: '1px 5px' }}>CE MOIS</span>}
                        </div>
                        <span style={{ textAlign: 'right', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.montantDu)}</span>
                        <span style={{ textAlign: 'right', fontSize: 12, color: item.montantPaye > 0 ? '#16a34a' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
                          {item.montantPaye > 0 ? fmt(item.montantPaye) : '—'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                          <input type="number" min="0" step="0.001" value={sel.amount} disabled={!sel.checked}
                            onChange={(e) => setSelections((prev) => ({ ...prev, [item.moisKey]: { ...sel, amount: e.target.value } }))}
                            style={{ width: 80, padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text)', background: 'var(--surface)', textAlign: 'right' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="modal-section-card full-width">
                  <div className="modal-section-hdr">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 13, height: 13 }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span className="modal-section-label">Date de paiement</span>
                  </div>
                  <div className="modal-section-body">
                    <div className="field"><DatePicker value={date} onChange={setDate} /></div>
                  </div>
                </div>
                <div className="modal-section-card full-width" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.18)' }}>
                  <div className="modal-section-hdr">
                    <span className="modal-section-label" style={{ color: 'var(--accent)' }}>Total à payer</span>
                  </div>
                  <div className="modal-section-body" style={{ paddingTop: 4 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
                      {fmt(total)} <span style={{ fontSize: 13, fontWeight: 600 }}>TND</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      {allItems.filter((m) => selections[m.moisKey]?.checked).length} mois sélectionnés
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={handleConfirm} disabled={total <= 0} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }} style={{ opacity: total <= 0 ? 0.5 : 1 }}>
                Confirmer le paiement
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
  open: boolean; charge: ChargeFixe | null; onClose: () => void; onConfirm: () => void;
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
                <div className="add-client-modal-title">Supprimer la charge</div>
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
              ne sera plus comptabilisée à partir de ce mois. L&apos;historique des paiements précédents sera conservé.
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
export default function ChargesFixes() {
  const { mois, label: moisLabel } = useMoisCourant();
  const { charges, loading, totalMensuel, totalImpayes, overdueCount, findMergeCandidate, addCharge, updateCharge, removeCharge, marquerPayee } = useChargesFixes(mois);

  const [adding,         setAdding]         = useState(false);
  const [editingCharge,  setEditingCharge]  = useState<ChargeFixe | null>(null);
  const [payingCharge,   setPayingCharge]   = useState<ChargeFixe | null>(null);
  const [deletingCharge, setDeletingCharge] = useState<ChargeFixe | null>(null);

  const today = new Date().getDate();
  const currentMois = currentMoisStr();
  const isCurrentMonth = mois === currentMois;

  const _candidate = findMergeCandidate; // referenced to avoid unused import warning

  return (
    <>
      {/* Stats */}
      <motion.div className="dec-stats" initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}>
        {[
          <div className="dec-stat" key="total">
            <div className="dec-stat-label">Total mensuel</div>
            <div className="dec-stat-value">{fmt(totalMensuel)} TND</div>
          </div>,
          <div className={`dec-stat${totalImpayes > 0 ? ' dec-stat--red' : ' dec-stat--green'}`} key="impayes">
            <div className="dec-stat-label">Total impayés ce mois</div>
            <div className="dec-stat-value">{fmt(totalImpayes)} TND</div>
          </div>,
          isCurrentMonth && overdueCount > 0 ? (
            <div className="dec-stat dec-stat--red" key="retard">
              <div className="dec-stat-label">En retard</div>
              <div className="dec-stat-value">{overdueCount}</div>
            </div>
          ) : null,
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
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Charges fixes — <strong>{moisLabel}</strong>
        </div>
        <motion.button className="btn-add-client" onClick={() => setAdding(true)} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter une charge
        </motion.button>
      </motion.div>

      {/* Modals */}
      <ConfirmDeleteModal open={deletingCharge !== null} charge={deletingCharge}
        onClose={() => setDeletingCharge(null)}
        onConfirm={() => { if (deletingCharge) removeCharge(deletingCharge.id); setDeletingCharge(null); }} />
      <PaymentModal open={payingCharge !== null} charge={payingCharge} mois={mois} moisLabel={moisLabel}
        onClose={() => setPayingCharge(null)}
        onPay={(payments) => { payments.forEach((p) => marquerPayee(p.chargeId, p.moisCible, p.montant, p.dateISO)); setPayingCharge(null); }} />
      <ChargeModal open={adding} charge={null}
        onClose={() => setAdding(false)}
        onSave={async (data) => {
          const err = await addCharge({ label: data.label, montant: data.montant, tvaTaux: data.tvaTaux, jourEcheance: data.jourEcheance, cycleMonths: data.cycleMonths });
          if (!err) setAdding(false);
          return err;
        }} />
      <ChargeModal open={editingCharge !== null} charge={editingCharge}
        onClose={() => setEditingCharge(null)}
        onSave={async ({ date: _date, ...data }) => {
          if (!editingCharge) return;
          const err = await updateCharge(editingCharge.id, data);
          if (!err) setEditingCharge(null);
          return err;
        }} />

      {/* Charges list */}
      <motion.div className="dec-card"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.2 }}>
        <div className="dec-card-title">Charges récurrentes</div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--faint)', fontSize: 13 }}>Chargement…</div>
        ) : charges.length === 0 ? (
          <motion.div className="dec-empty" style={{ padding: '24px 0' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <p>Aucune charge fixe</p>
            <span>Ajoutez des charges récurrentes pour les suivre mois après mois.</span>
          </motion.div>
        ) : charges.map((c, rowIdx) => {
          const overdue    = isCurrentMonth && c.status !== 'payee' && today > c.jourEcheance;
          const hasOutstanding = c.resteAPayer > 0 || c.moisImpayes.length > 0;

          return (
            <motion.div className="dec-charge-row" key={c.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.24, ease: EASE_OUT, delay: 0.22 + rowIdx * 0.06 }}>
              <div className="dec-charge-label">
                {c.label}
                {overdue && <span className="dec-overdue-alert" style={{ marginLeft: 8 }}>En retard</span>}
                {c.moisImpayes.length > 0 && (
                  <span className="dec-carryover-badge">
                    {c.moisImpayes.length} mois reporté{c.moisImpayes.length > 1 ? 's' : ''} · {fmt(c.cumulImpaye)} TND
                  </span>
                )}
              </div>
              <div className="dec-charge-due">
                Échéance : {c.jourEcheance} du mois
                {c.cycleMonths !== 1 && (
                  <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'rgba(232,98,26,0.10)', borderRadius: 4, padding: '1px 6px' }}>
                    {cycleLabel(c.cycleMonths).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="dec-charge-montant">
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(c.montant)} TND</span>
                {c.status === 'partielle' && (
                  <span style={{ fontSize: 10, color: '#d97706', marginLeft: 6 }}>
                    payé {fmt(c.montantPaye)} / reste {fmt(c.resteAPayer)}
                  </span>
                )}
                {c.tvaTaux > 0 && (() => {
                  const ht = +(c.montant / (1 + c.tvaTaux / 100)).toFixed(3);
                  const tvaAmt = +(c.montant - ht).toFixed(3);
                  return (
                    <span style={{ display: 'flex', gap: 6, marginTop: 2, fontSize: 10, color: 'var(--muted)' }}>
                      <span>HT : {fmt(ht)}</span><span>·</span>
                      <span style={{ color: '#16a34a' }}>TVA ({c.tvaTaux}%) : {fmt(tvaAmt)}</span>
                    </span>
                  );
                })()}
              </div>
              {c.status === 'payee' && !hasOutstanding ? (
                <span className="dec-badge dec-badge--green">Payée</span>
              ) : c.status === 'payee' && hasOutstanding ? (
                <button className="dec-btn dec-btn--green dec-btn--sm" onClick={() => setPayingCharge(c)}>Régler reports</button>
              ) : c.status === 'partielle' ? (
                <button className="dec-btn dec-btn--sm" onClick={() => setPayingCharge(c)} style={{ borderColor: '#d97706', color: '#d97706' }}>Paiement partiel</button>
              ) : (
                <button className="dec-btn dec-btn--green dec-btn--sm" onClick={() => setPayingCharge(c)}>
                  {c.moisImpayes.length > 0 ? `Payer (${c.moisImpayes.length + 1} mois)` : 'Marquer payée'}
                </button>
              )}
              {c.montantPaye === 0 && (
                <button className="dec-btn dec-btn--sm" title="Modifier" onClick={() => setEditingCharge(c)} style={{ padding: '4px 8px', color: 'var(--muted)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              )}
              {c.montantPaye === 0 && (
                <button className="dec-btn dec-btn--sm" title="Supprimer" onClick={() => setDeletingCharge(c)} style={{ padding: '4px 8px', color: 'var(--muted)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}>
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                </button>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Payment history */}
      {charges.some((c) => c.historique.length > 0) && (
        <motion.div className="dec-card"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.35 }}>
          <div className="dec-card-title">Historique des paiements — {moisLabel}</div>
          <table className="dec-table" style={{ textAlign: 'center' }}>
            <thead>
              <tr><th style={{ textAlign: 'center' }}>Charge</th><th style={{ textAlign: 'center' }}>Montant</th><th style={{ textAlign: 'center' }}>Date</th></tr>
            </thead>
            <tbody>
              {charges
                .flatMap((c) => c.historique.map((h) => ({ ...h, chargeLabel: c.label })))
                .sort((a, b) => b.datePaiement.localeCompare(a.datePaiement))
                .map((h, i) => (
                  <motion.tr key={h.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT, delay: 0.38 + i * 0.05 }}>
                    <td style={{ textAlign: 'center' }}>{h.chargeLabel}</td>
                    <td className="num" style={{ textAlign: 'center' }}>{fmt(h.montant)} TND</td>
                    <td style={{ textAlign: 'center' }}>{new Date(h.datePaiement).toLocaleDateString('fr-FR')}</td>
                  </motion.tr>
                ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </>
  );
}
