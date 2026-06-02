import { useState, useEffect, useMemo, useCallback } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT } from '@/lib/framer-motion-constants';
import { useMoisCourant } from './MoisContext';
import api from '@/lib/api';
import '@/features/clients/clients.css';
import './decaissements.css';

/* ── Utility ── */
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function tvaOf(montant: number, taux: number): number {
  if (taux <= 0) return 0;
  return +(montant - montant / (1 + taux / 100)).toFixed(3);
}

const FR_MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const FR_MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

function moisLabelFn(mois: string) {
  const [y, m] = mois.split('-').map(Number);
  return `${FR_MONTHS[m - 1]} ${y}`;
}
function nextMonthStart(mois: string) {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/* ── Quarter logic ── */
function resolveDisplayQuarter(year: number, month: number) {
  switch (month) {
    case 1:  return { q: 4, year: year - 1, isPaymentMonth: true };
    case 4:  return { q: 1, year,            isPaymentMonth: true };
    case 7:  return { q: 2, year,            isPaymentMonth: true };
    case 10: return { q: 3, year,            isPaymentMonth: true };
    default: return { q: Math.ceil(month / 3), year, isPaymentMonth: false };
  }
}
function getQuarterMonths(q: number, year: number): string[] {
  const startMonth = (q - 1) * 3 + 1;
  return [0, 1, 2].map((i) => {
    const m = startMonth + i;
    return `${year}-${String(m).padStart(2, '0')}`;
  });
}
function getQuarterInfo(q: number, year: number) {
  const qMonths = getQuarterMonths(q, year);
  const qLabels = qMonths.map((m) => FR_MONTHS_SHORT[Number(m.split('-')[1]) - 1]);
  const deadlineMonthIdx = [3, 6, 9, 0][q - 1];
  const deadlineYear = q === 4 ? year + 1 : year;
  const deadline = new Date(deadlineYear, deadlineMonthIdx, 15);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = today > deadline;
  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
  let monthsLate = 0;
  if (isOverdue) {
    monthsLate = (today.getFullYear() - deadline.getFullYear()) * 12 + (today.getMonth() - deadline.getMonth());
    if (today.getDate() < 15) monthsLate = Math.max(0, monthsLate - 1);
    monthsLate = Math.max(1, monthsLate);
  }
  return { q, year, qMonths, qLabels, deadline, deadlineLabel: deadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), isOverdue, daysLeft, monthsLate, penalteRate: monthsLate * 0.01 };
}

/* ── Types ── */
interface SalaireMensuel {
  id: string; employee_id: string; mois: string;
  snap_brut_effectif?: number; snap_cnss_salarie?: number; snap_irpp_mensuel?: number;
}
interface ChargeFixeDef { id: string; montant: number; tvaTaux: number; createdAt: string; archivedAt: string | null; cycleMonths: number; }
interface ChargeVariable { id: string; montant: number; tvaTaux: number; }
interface Payment { id: string; invoiceNumber: string; clientName?: string; totalHt: number; totalTva: number; totalTtc: number; amountPaid: number; status: string; paidAt?: string; sentAt?: string; dateIssued: string; }
interface CnssTrimestre { id?: string; annee: number; trimestre: number; montantSalarie: number; montantEmployeur: number; montantPenalite: number; montantTotal: number; datePaiement?: string; statut: string; }
interface CnssHistorique { id: string; annee: number; trimestre: number; montantSalarie: number; montantEmployeur: number; montantPenalite: number; montantTotal: number; datePaiement: string; note?: string; }

interface TaxeManuelle { id: string; label: string; montant: number; dateEcheance: string; status: 'due' | 'payee'; }

function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}
function isDueInMonth(def: ChargeFixeDef, mois: string): boolean {
  const anchor = def.createdAt.slice(0, 7);
  if (mois < anchor) return false;
  if (def.archivedAt && def.archivedAt.slice(0, 7) <= mois) return false;
  return monthsBetween(anchor, mois) % def.cycleMonths === 0;
}

/* ── Main hook ── */
function useEtatData(viewingMois: string) {
  const [salaires,   setSalaires]   = useState<SalaireMensuel[]>([]);
  const [fixesDefs,  setFixesDefs]  = useState<ChargeFixeDef[]>([]);
  const [variables,  setVariables]  = useState<ChargeVariable[]>([]);
  const [payments,   setPayments]   = useState<Payment[]>([]);
  const [cnssRecord, setCnssRecord] = useState<CnssTrimestre | null>(null);
  const [cnssHisto,  setCnssHisto]  = useState<CnssHistorique[]>([]);
  const [qSalaires,  setQSalaires]  = useState<Record<string, SalaireMensuel[]>>({});
  const [loading,    setLoading]    = useState(true);

  const [viewYear, viewMonth] = viewingMois.split('-').map(Number);
  const { q, year, isPaymentMonth } = useMemo(() => resolveDisplayQuarter(viewYear, viewMonth), [viewYear, viewMonth]);
  const qMonths = useMemo(() => getQuarterMonths(q, year), [q, year]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [salRes, fixesRes, varRes, payRes, cnssRes, cnssHistRes] = await Promise.all([
        api.get<SalaireMensuel[]>(`/api/payroll/salaires?mois=${viewingMois}`).catch(() => ({ data: [] as SalaireMensuel[] })),
        api.get<ChargeFixeDef[]>('/api/charges/fixes').catch(() => ({ data: [] as ChargeFixeDef[] })),
        api.get<ChargeVariable[]>(`/api/charges/variables?mois=${viewingMois}`).catch(() => ({ data: [] as ChargeVariable[] })),
        api.get<Payment[]>(`/api/payments`).catch(() => ({ data: [] as Payment[] })),
        api.get<CnssTrimestre>(`/api/cnss/trimestres/${year}/${q}`).catch(() => ({ data: null })),
        api.get<CnssHistorique[]>(`/api/cnss/historique/${year}/${q}`).catch(() => ({ data: [] as CnssHistorique[] })),
      ]);
      setSalaires(salRes.data ?? []);
      setFixesDefs(fixesRes.data ?? []);
      setVariables(varRes.data ?? []);
      const toIso = (v: unknown): string | null => {
        if (v == null) return null;
        if (typeof v === 'string') return v;
        if (typeof v === 'number') return new Date(v * (v < 1e12 ? 1000 : 1)).toISOString();
        if (Array.isArray(v) && v.length >= 3) {
          const [y, m, d, h = 0, mi = 0, s = 0] = v as number[];
          return new Date(Date.UTC(y, m - 1, d, h, mi, s)).toISOString();
        }
        try { return new Date(v as never).toISOString(); } catch { return null; }
      };
      setPayments(((payRes.data ?? []) as Payment[]).map((p) => ({
        ...p,
        paidAt: toIso((p as { paidAt?: unknown }).paidAt) as unknown as Payment['paidAt'],
        sentAt: toIso((p as { sentAt?: unknown }).sentAt) as unknown as Payment['sentAt'],
      })));
      setCnssRecord(cnssRes.data ?? null);
      setCnssHisto(cnssHistRes.data ?? []);

      // Fetch per-quarter-month salaries for past months
      const pastMonths = qMonths.filter((m) => m !== viewingMois);
      const qSalPairs = await Promise.all(
        pastMonths.map((m) => api.get<SalaireMensuel[]>(`/api/payroll/salaires?mois=${m}`).then((r) => [m, r.data ?? []] as [string, SalaireMensuel[]]).catch(() => [m, []] as [string, SalaireMensuel[]]))
      );
      const qSalMap: Record<string, SalaireMensuel[]> = {};
      qSalPairs.forEach(([m, sals]) => { qSalMap[m] = sals; });
      setQSalaires(qSalMap);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [viewingMois, year, q, qMonths]);

  useEffect(() => { load(); }, [load]);

  // Compute salary totals for current month
  const salTotaux = useMemo(() => {
    let cnssSal = 0, brut = 0, irpp = 0;
    salaires.forEach((s) => {
      brut     += s.snap_brut_effectif ?? 0;
      cnssSal  += s.snap_cnss_salarie  ?? 0;
      irpp     += s.snap_irpp_mensuel  ?? 0;
    });
    const cnssEmp = +(brut * 0.1657).toFixed(3);
    const tfp     = +(brut * 0.02).toFixed(3);
    const foprolos = +(brut * 0.01).toFixed(3);
    return { cnssSalarie: +cnssSal.toFixed(3), cnssEmployeur: cnssEmp, irpp: +irpp.toFixed(3), tfp, foprolos, brut: +brut.toFixed(3) };
  }, [salaires]);

  // CNSS per-month data for the quarter
  const cnssMonthData = useMemo(() => {
    return qMonths.map((m) => {
      const monthSals = m === viewingMois ? salaires : (qSalaires[m] ?? []);
      let brut = 0, cnssSal = 0;
      monthSals.forEach((s) => { brut += s.snap_brut_effectif ?? 0; cnssSal += s.snap_cnss_salarie ?? 0; });
      const cnssEmp = +(brut * 0.1657).toFixed(3);
      const salarie = +cnssSal.toFixed(3);
      const employeur = cnssEmp;
      const total = +(salarie + employeur).toFixed(3);
      return { moisKey: m, label: moisLabelFn(m), salarie, employeur, total, isCurrentMonth: m === viewingMois, employeeCount: monthSals.length };
    });
  }, [qMonths, viewingMois, salaires, qSalaires]);

  const cnssQuarterTotals = useMemo(() => {
    const totalSalarie  = +cnssMonthData.reduce((s, m) => s + m.salarie,   0).toFixed(3);
    const totalEmployeur = +cnssMonthData.reduce((s, m) => s + m.employeur, 0).toFixed(3);
    const totalBrut = +(totalSalarie + totalEmployeur).toFixed(3);
    return { totalSalarie, totalEmployeur, totalBrut };
  }, [cnssMonthData]);

  // TVA collectée from paid/partial invoices in the month
  const tvaData = useMemo(() => {
    const monthStart = `${viewingMois}-01`;
    const monthEnd = nextMonthStart(viewingMois);
    const entries = payments.filter((p) => {
      if (p.status !== 'paid' && p.status !== 'partial') return false;
      const dateStr = p.paidAt ? p.paidAt.slice(0, 10) : p.dateIssued;
      return dateStr >= monthStart && dateStr < monthEnd;
    }).map((p) => {
      const tvaProp = p.totalTtc > 0 ? (p.amountPaid / p.totalTtc) : 1;
      return { invoiceNumber: p.invoiceNumber, clientName: p.clientName ?? '', tvaAmount: +(p.totalTva * Math.min(tvaProp, 1)).toFixed(3), totalTtc: p.totalTtc, amountPaid: p.amountPaid, status: p.status as 'paid' | 'partial' };
    });
    const tvaCollectee = +entries.reduce((s, e) => s + e.tvaAmount, 0).toFixed(3);
    return { entries, tvaCollectee };
  }, [payments, viewingMois]);

  // TVA déductible from charges
  const tvaFixesDefs = useMemo(() => fixesDefs.filter((d) => isDueInMonth(d, viewingMois) && d.tvaTaux > 0), [fixesDefs, viewingMois]);
  const tvaVariables = useMemo(() => variables.filter((c) => c.tvaTaux > 0), [variables]);
  const tvaDeductible = useMemo(() => {
    const f = tvaFixesDefs.reduce((s, c) => s + tvaOf(c.montant, c.tvaTaux), 0);
    const v = tvaVariables.reduce((s, c) => s + tvaOf(c.montant, c.tvaTaux), 0);
    return +(f + v).toFixed(3);
  }, [tvaFixesDefs, tvaVariables]);

  const payerCnss = useCallback(async (penalite: number, dateISO: string) => {
    const { totalSalarie, totalEmployeur } = cnssQuarterTotals;
    const total = +(totalSalarie + totalEmployeur + penalite).toFixed(3);
    try {
      const { data } = await api.post<CnssTrimestre>(`/api/cnss/trimestres/${year}/${q}/pay`, {
        montantSalarie: totalSalarie, montantEmployeur: totalEmployeur, montantPenalite: penalite, note: '',
      });
      if (data) { setCnssRecord(data); load(); }
    } catch { /* ignore */ }
  }, [cnssQuarterTotals, year, q, load]);

  return { loading, salTotaux, cnssMonthData, cnssQuarterTotals, cnssRecord, cnssHisto, tvaData, tvaDeductible, tvaFixesDefs: fixesDefs.filter((d) => isDueInMonth(d, viewingMois)), tvaVariables: variables, q, year, isPaymentMonth, payerCnss };
}

/* ── Add Taxe Modal ── */
function AddTaxeModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (d: { label: string; montant: number; dateEcheance: string }) => void; }) {
  const today = new Date().toISOString().slice(0, 10);
  const [label, setLabel] = useState(''); const [montant, setMontant] = useState(''); const [date, setDate] = useState(today);
  function reset() { setLabel(''); setMontant(''); setDate(today); }
  function handleClose() { reset(); onClose(); }
  function handleAdd() { if (!label.trim() || !montant) return; onAdd({ label: label.trim(), montant: +montant, dateEcheance: date }); reset(); }
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10000 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 480 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Nouvelle taxe manuelle</div>
                <div className="modal-topbar-sub">Patente, TCL, droit de timbre…</div>
              </div>
              <motion.button className="modal-close-btn" onClick={handleClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>
            <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
                  <span className="modal-section-label">Détails de la taxe</span>
                </div>
                <div className="modal-section-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="field">
                    <label>Libellé <span className="req">*</span></label>
                    <input type="text" placeholder="ex : Patente, TCL, Droit de timbre…" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
                  </div>
                  <div className="modal-fields-row">
                    <div className="field">
                      <label>Montant (TND) <span className="req">*</span></label>
                      <input type="number" min="0" step="0.001" placeholder="0.000" value={montant} onChange={(e) => setMontant(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Date d&apos;échéance</label>
                      <DatePicker value={date} onChange={setDate} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={handleClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={handleAdd} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}>Ajouter la taxe</motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── CNSS Payment Modal ── */
function CnssPaymentModal({ open, onClose, q, year, monthData, totalSalarie, totalEmployeur, totalBrut, deadline, onPay }: {
  open: boolean; onClose: () => void; q: number; year: number;
  monthData: { moisKey: string; label: string; salarie: number; employeur: number; total: number; isCurrentMonth: boolean; employeeCount: number }[];
  totalSalarie: number; totalEmployeur: number; totalBrut: number; deadline: Date;
  onPay: (penalite: number, dateISO: string) => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => { if (open) setDate(new Date().toISOString().slice(0, 10)); }, [open]);

  const payDate = new Date(date); payDate.setHours(0, 0, 0, 0);
  const isLate = payDate > deadline;
  let monthsLate = 0;
  if (isLate) {
    monthsLate = (payDate.getFullYear() - deadline.getFullYear()) * 12 + (payDate.getMonth() - deadline.getMonth());
    if (payDate.getDate() < 15) monthsLate = Math.max(0, monthsLate - 1);
    monthsLate = Math.max(1, monthsLate);
  }
  const penalite = isLate ? +(totalBrut * monthsLate * 0.01).toFixed(3) : 0;
  const totalAPayer = +(totalBrut + penalite).toFixed(3);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="add-client-overlay" style={{ zIndex: 10000 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div className="add-client-modal" style={{ maxWidth: 560 }}
            initial={{ scale: 0.93, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.93, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-topbar">
              <div className="modal-topbar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div className="modal-topbar-text">
                <div className="add-client-modal-title">Payer CNSS — T{q} {year}</div>
                <div className="modal-topbar-sub">Cotisations trimestrielles à la CNSS</div>
              </div>
              <motion.button className="modal-close-btn" onClick={onClose} whileTap={{ scale: 0.9 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </motion.button>
            </div>
            <div className="modal-scroll-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span className="modal-section-label">Date de paiement</span>
                </div>
                <div className="modal-section-body">
                  <div className="field"><DatePicker value={date} onChange={setDate} /></div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    Date limite : {deadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {!isLate && <span style={{ marginLeft: 8, color: '#16a34a', fontWeight: 600 }}>— dans les délais, aucune pénalité</span>}
                  </div>
                </div>
              </div>
              <div className="modal-section-card full-width">
                <div className="modal-section-hdr">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M9 11l3 3L22 4"/></svg>
                  <span className="modal-section-label">Détail par mois</span>
                </div>
                <div className="modal-section-body">
                  <table className="dec-table" style={{ marginBottom: 0 }}>
                    <thead><tr><th>Mois</th><th style={{ textAlign: 'right' }}>Salarié</th><th style={{ textAlign: 'right' }}>Employeur</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                    <tbody>
                      {monthData.map((m) => (
                        <tr key={m.moisKey} style={m.isCurrentMonth ? { background: 'rgba(37,99,235,0.04)' } : {}}>
                          <td>{m.label}{m.isCurrentMonth && <span style={{ fontSize: 10, marginLeft: 6, color: '#2563eb', fontWeight: 700 }}>(mois en cours)</span>}</td>
                          <td className="num">{fmt(m.salarie)} TND</td>
                          <td className="num">{fmt(m.employeur)} TND</td>
                          <td className="num" style={{ fontWeight: 600 }}>{fmt(m.total)} TND</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td>Sous-total T{q}</td>
                        <td className="num">{fmt(totalSalarie)} TND</td>
                        <td className="num">{fmt(totalEmployeur)} TND</td>
                        <td className="num" style={{ fontWeight: 800 }}>{fmt(totalBrut)} TND</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              {isLate && (
                <div className="modal-section-card full-width" style={{ border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.03)' }}>
                  <div className="modal-section-hdr">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span className="modal-section-label" style={{ color: '#dc2626' }}>Pénalité de retard</span>
                  </div>
                  <div className="modal-section-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{monthsLate} mois de retard × 1%/mois = {monthsLate}%</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Appliqué sur {fmt(totalBrut)} TND</div>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{fmt(penalite)} TND</div>
                    </div>
                  </div>
                </div>
              )}
              <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 12, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Total à verser à la CNSS</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>{fmt(totalAPayer)} TND</div>
              </div>
            </div>
            <div className="modal-action-bar">
              <motion.button className="btn-cancel" onClick={onClose} whileTap={{ scale: 0.95 }}>Annuler</motion.button>
              <motion.button className="btn-save" onClick={() => { onPay(penalite, date); onClose(); }} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
                style={{ background: '#16a34a', filter: 'drop-shadow(0px 4px 10px rgba(22,163,74,0.35))', width: 'auto', padding: '11px 24px', whiteSpace: 'nowrap' }}>
                Confirmer le paiement · {fmt(totalAPayer)} TND
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Etat page ── */
export default function Etat() {
  const { mois, label: moisLabel } = useMoisCourant();
  const { loading, salTotaux, cnssMonthData, cnssQuarterTotals, cnssRecord, cnssHisto, tvaData, tvaDeductible, tvaFixesDefs, tvaVariables, q, year, isPaymentMonth, payerCnss } = useEtatData(mois);

  const [taxesManuelles, setTaxesManuelles] = useState<TaxeManuelle[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCnssModal, setShowCnssModal] = useState(false);
  const [tvaOpen,  setTvaOpen]  = useState(false);
  const [cnssOpen, setCnssOpen] = useState(false);
  const [autresOpen, setAutresOpen] = useState(false);

  const taxesAuto = useMemo(() => [
    { label: 'IRPP retenue à la source', montant: salTotaux.irpp },
    { label: 'TFP',                      montant: salTotaux.tfp },
    { label: 'FOPROLOS',                 montant: salTotaux.foprolos },
  ].filter((t) => t.montant > 0), [salTotaux]);

  const totalAuto = taxesAuto.reduce((s, t) => s + t.montant, 0);
  const totalManuel = taxesManuelles.filter((t) => t.status === 'due').reduce((s, t) => s + t.montant, 0);
  const totalDu = +(totalAuto + totalManuel).toFixed(3);

  const tvaNette = +(tvaData.tvaCollectee - tvaDeductible).toFixed(3);

  const qi = useMemo(() => getQuarterInfo(q, year), [q, year]);
  const isPaid = cnssRecord?.statut === 'payee';

  return (
    <>
      {/* Stats */}
      <motion.div className="dec-stats" initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.07 } } }}>
        {[
          <div className="dec-stat dec-stat--amber" key="total"><div className="dec-stat-label">Total dû</div><div className="dec-stat-value">{fmt(totalDu)} TND</div></div>,
          <div className="dec-stat" key="auto"><div className="dec-stat-label">Taxes auto (salaires)</div><div className="dec-stat-value">{fmt(totalAuto)} TND</div></div>,
          <div className="dec-stat" key="manuel"><div className="dec-stat-label">Taxes manuelles dues</div><div className="dec-stat-value">{fmt(totalManuel)} TND</div></div>,
          <div className={`dec-stat${tvaNette > 0 ? ' dec-stat--red' : tvaNette < 0 ? ' dec-stat--green' : ''}`} key="tva">
            <div className="dec-stat-label">TVA nette — {moisLabel}</div>
            <div className="dec-stat-value">{loading ? '…' : `${fmt(Math.abs(tvaNette))} TND`}</div>
          </div>,
        ].map((child, i) => (
          <motion.div key={i} variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } } }}>{child}</motion.div>
        ))}
      </motion.div>

      {/* Manual taxes toolbar */}
      <motion.div className="dec-toolbar" style={{ justifyContent: 'space-between' }}
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: EASE_OUT, delay: 0.18 }}>
        <div className="sal-month-banner" style={{ margin: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ width: 14, height: 14 }}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
          Taxes manuelles — <strong>{moisLabel}</strong>
        </div>
        <motion.button className="btn-add-client" onClick={() => setShowAddModal(true)} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter une taxe
        </motion.button>
      </motion.div>

      <AddTaxeModal open={showAddModal} onClose={() => setShowAddModal(false)}
        onAdd={(data) => { setTaxesManuelles((prev) => [...prev, { id: crypto.randomUUID(), label: data.label, montant: data.montant, dateEcheance: data.dateEcheance, status: 'due' }]); setShowAddModal(false); }} />

      <motion.div className="dec-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.24 }}>
        {taxesManuelles.length === 0 ? (
          <motion.div className="dec-empty" style={{ padding: '24px 0' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: 0.1 }}>
            <p>Aucune taxe manuelle</p>
            <span>Ajoutez les taxes ponctuelles non calculées automatiquement.</span>
          </motion.div>
        ) : (
          <table className="dec-table">
            <thead><tr><th>Taxe</th><th>Échéance</th><th style={{ textAlign: 'right' }}>Montant</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {taxesManuelles.map((t) => (
                <tr key={t.id}>
                  <td>{t.label}</td>
                  <td>{new Date(t.dateEcheance).toLocaleDateString('fr-FR')}</td>
                  <td className="num">{fmt(t.montant)} TND</td>
                  <td>
                    <span className={`dec-badge ${t.status === 'payee' ? 'dec-badge--green' : 'dec-badge--amber'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setTaxesManuelles((prev) => prev.map((x) => x.id === t.id ? { ...x, status: x.status === 'due' ? 'payee' : 'due' } : x))}>
                      {t.status === 'payee' ? 'Payée' : 'Due'}
                    </span>
                  </td>
                  <td>
                    <button className="dec-btn dec-btn--sm" onClick={() => setTaxesManuelles((prev) => prev.filter((x) => x.id !== t.id))} style={{ padding: '4px 8px', color: 'var(--muted)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* TVA Balance */}
      <motion.div className="dec-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.3 }}>
        <button onClick={() => setTvaOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          <div className="dec-card-title" style={{ margin: 0 }}>Bilan TVA — {moisLabel}</div>
          <motion.svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18, flexShrink: 0 }} animate={{ rotate: tvaOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <polyline points="6 9 12 15 18 9"/>
          </motion.svg>
        </button>
        <AnimatePresence initial={false}>
          {tvaOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '16px 0 18px' }}>
                <div style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.18)', borderRadius: 14, padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#16a34a', marginBottom: 8 }}>TVA collectée</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{loading ? '…' : `${fmt(tvaData.tvaCollectee)} TND`}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{tvaData.entries.length} facture{tvaData.entries.length !== 1 ? 's' : ''} payée{tvaData.entries.length !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.18)', borderRadius: 14, padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#2563eb', marginBottom: 8 }}>TVA déductible</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>{fmt(tvaDeductible)} TND</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>charges fixes + variables</div>
                </div>
              </div>
              <table className="dec-table">
                <thead><tr><th>Source</th><th>Détail</th><th style={{ textAlign: 'right' }}>TVA</th></tr></thead>
                <tbody>
                  {tvaData.entries.length === 0 ? (
                    <tr><td><span className="dec-badge dec-badge--green">Collectée</span></td><td style={{ color: 'var(--faint)', fontSize: 12 }}>Aucune facture payée ce mois</td><td className="num">0.000 TND</td></tr>
                  ) : tvaData.entries.map((e) => (
                    <tr key={e.invoiceNumber}>
                      <td><span className="dec-badge dec-badge--green">Collectée</span></td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{e.invoiceNumber}</div>
                        {e.clientName && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.clientName}</div>}
                        {e.status === 'partial' && <div style={{ fontSize: 10, color: '#d97706', marginTop: 2 }}>Paiement partiel — {fmt(e.amountPaid)} / {fmt(e.totalTtc)} TND</div>}
                      </td>
                      <td className="num">{fmt(e.tvaAmount)} TND</td>
                    </tr>
                  ))}
                  {tvaFixesDefs.filter((c) => c.tvaTaux > 0).length === 0 ? (
                    <tr><td><span className="dec-badge dec-badge--blue">Déductible</span></td><td style={{ color: 'var(--faint)', fontSize: 12 }}>Aucune charge fixe avec TVA</td><td className="num">0.000 TND</td></tr>
                  ) : tvaFixesDefs.filter((c) => c.tvaTaux > 0).map((c) => (
                    <tr key={`fix-${c.id}`}>
                      <td><span className="dec-badge dec-badge--blue">Déductible</span></td>
                      <td><div style={{ fontSize: 13, fontWeight: 600 }}>Charge fixe</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>TVA {c.tvaTaux}% · TTC {fmt(c.montant)} TND</div></td>
                      <td className="num" style={{ color: '#2563eb' }}>−{fmt(tvaOf(c.montant, c.tvaTaux))} TND</td>
                    </tr>
                  ))}
                  {tvaVariables.filter((c) => c.tvaTaux > 0).map((c) => (
                    <tr key={`var-${c.id}`}>
                      <td><span className="dec-badge dec-badge--blue">Déductible</span></td>
                      <td><div style={{ fontSize: 13, fontWeight: 600 }}>Charge variable</div><div style={{ fontSize: 11, color: 'var(--muted)' }}>TVA {c.tvaTaux}% · TTC {fmt(c.montant)} TND</div></td>
                      <td className="num" style={{ color: '#2563eb' }}>−{fmt(tvaOf(c.montant, c.tvaTaux))} TND</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td colSpan={2} style={{ color: tvaNette > 0 ? '#dc2626' : tvaNette < 0 ? '#16a34a' : 'inherit' }}>
                      {tvaNette > 0 ? "⚠ TVA à reverser à l'État" : tvaNette < 0 ? '✓ Crédit TVA en votre faveur' : 'TVA équilibrée'}
                    </td>
                    <td className="num" style={{ color: tvaNette > 0 ? '#dc2626' : tvaNette < 0 ? '#16a34a' : 'inherit', fontWeight: 800 }}>{fmt(Math.abs(tvaNette))} TND</td>
                  </tr>
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* CNSS */}
      <motion.div className="dec-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.36 }}>
        <button onClick={() => setCnssOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          <div className="dec-card-title" style={{ margin: 0 }}>CNSS — T{q} {year}</div>
          <motion.svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18, flexShrink: 0 }} animate={{ rotate: cnssOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <polyline points="6 9 12 15 18 9"/>
          </motion.svg>
        </button>
        <AnimatePresence initial={false}>
          {cnssOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
              {/* Quarter banner */}
              <div style={{ marginTop: 16, marginBottom: 18, borderRadius: 14, border: isPaid ? '1px solid rgba(22,163,74,0.35)' : `1px solid ${qi.isOverdue ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.25)'}`, background: isPaid ? 'rgba(22,163,74,0.06)' : qi.isOverdue ? 'rgba(220,38,38,0.05)' : 'rgba(22,163,74,0.05)', padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>Trimestre</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>T{qi.q} {qi.year}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{qi.qLabels.join(' · ')}</div>
                </div>
                <div style={{ width: 1, height: 44, background: 'var(--border)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 4 }}>Date limite</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{qi.deadlineLabel}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Paiement trimestriel CNSS</div>
                </div>
                <div style={{ width: 1, height: 44, background: 'var(--border)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 140 }}>
                  {isPaid ? (
                    <><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#16a34a', marginBottom: 4 }}>Payé</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>{fmt(cnssRecord!.montantTotal)} TND</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{cnssRecord!.datePaiement ? `Le ${new Date(cnssRecord!.datePaiement).toLocaleDateString('fr-FR')}` : ''}</div></>
                  ) : qi.isOverdue ? (
                    <><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#dc2626', marginBottom: 4 }}>En retard</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#dc2626' }}>{qi.monthsLate} mois de retard · pénalité {qi.monthsLate}%</div></>
                  ) : (
                    <><div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#16a34a', marginBottom: 4 }}>Dans les délais</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#16a34a' }}>{qi.daysLeft > 0 ? `${qi.daysLeft} jour${qi.daysLeft > 1 ? 's' : ''} restant${qi.daysLeft > 1 ? 's' : ''}` : "Échéance aujourd'hui"}</div></>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  {isPaid ? (
                    <span className="dec-badge dec-badge--green" style={{ fontSize: 12, padding: '4px 10px' }}>✓ Payé</span>
                  ) : (isPaymentMonth || qi.isOverdue) ? (
                    <motion.button onClick={() => setShowCnssModal(true)} whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.03 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: qi.isOverdue ? '#dc2626' : '#16a34a', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      Payer T{q} {year}
                    </motion.button>
                  ) : null}
                </div>
              </div>

              <CnssPaymentModal open={showCnssModal} onClose={() => setShowCnssModal(false)} q={q} year={year}
                monthData={cnssMonthData} totalSalarie={cnssQuarterTotals.totalSalarie}
                totalEmployeur={cnssQuarterTotals.totalEmployeur} totalBrut={cnssQuarterTotals.totalBrut}
                deadline={qi.deadline} onPay={payerCnss} />

              {/* Quarter mini-cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
                {[
                  { label: `Part salarié — T${q}`, value: cnssQuarterTotals.totalSalarie, color: '#2563eb' },
                  { label: `Part employeur — T${q}`, value: cnssQuarterTotals.totalEmployeur, color: '#7c3aed' },
                  { label: `Total à verser — T${q}`, value: cnssQuarterTotals.totalBrut, color: '#dc2626' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color, marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>{fmt(value)} TND</div>
                  </div>
                ))}
              </div>

              {/* Per-month table */}
              <table className="dec-table">
                <thead><tr><th>Mois</th><th style={{ textAlign: 'right' }}>Salarié</th><th style={{ textAlign: 'right' }}>Employeur</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                <tbody>
                  {cnssMonthData.map((m) => (
                    <tr key={m.moisKey} style={m.isCurrentMonth ? { background: 'rgba(37,99,235,0.04)' } : {}}>
                      <td><div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}{m.isCurrentMonth && <span style={{ fontSize: 10, marginLeft: 6, color: '#2563eb', fontWeight: 700 }}>en cours</span>}</div></td>
                      <td className="num" style={{ color: '#2563eb' }}>{fmt(m.salarie)} TND</td>
                      <td className="num" style={{ color: '#7c3aed' }}>{fmt(m.employeur)} TND</td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmt(m.total)} TND</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>Total T{q} {year}</td>
                    <td className="num" style={{ color: '#2563eb' }}>{fmt(cnssQuarterTotals.totalSalarie)} TND</td>
                    <td className="num" style={{ color: '#7c3aed' }}>{fmt(cnssQuarterTotals.totalEmployeur)} TND</td>
                    <td className="num" style={{ color: '#dc2626', fontWeight: 800 }}>{fmt(cnssQuarterTotals.totalBrut)} TND</td>
                  </tr>
                </tbody>
              </table>

              {/* CNSS history */}
              {cnssHisto.length > 0 && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 10 }}>Historique des paiements — T{q} {year}</div>
                  <table className="dec-table" style={{ marginBottom: 0 }}>
                    <thead><tr><th>Date de paiement</th><th style={{ textAlign: 'right' }}>Salarié</th><th style={{ textAlign: 'right' }}>Employeur</th><th style={{ textAlign: 'right' }}>Pénalité</th><th style={{ textAlign: 'right' }}>Total versé</th></tr></thead>
                    <tbody>
                      {cnssHisto.map((h, idx) => (
                        <tr key={h.id} style={idx === 0 ? { background: 'rgba(22,163,74,0.04)' } : {}}>
                          <td><div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(h.datePaiement).toLocaleDateString('fr-FR')}</div>{idx === 0 && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700 }}>dernier paiement</span>}</td>
                          <td className="num" style={{ color: '#2563eb' }}>{fmt(h.montantSalarie)} TND</td>
                          <td className="num" style={{ color: '#7c3aed' }}>{fmt(h.montantEmployeur)} TND</td>
                          <td className="num" style={{ color: h.montantPenalite > 0 ? '#dc2626' : 'var(--faint)' }}>{h.montantPenalite > 0 ? `${fmt(h.montantPenalite)} TND` : '—'}</td>
                          <td className="num" style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(h.montantTotal)} TND</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Autres taxes auto */}
      <motion.div className="dec-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.42 }}>
        <button onClick={() => setAutresOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
          <div className="dec-card-title" style={{ margin: 0 }}>Autres taxes</div>
          <motion.svg viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" style={{ width: 18, height: 18, flexShrink: 0 }} animate={{ rotate: autresOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <polyline points="6 9 12 15 18 9"/>
          </motion.svg>
        </button>
        <AnimatePresence initial={false}>
          {autresOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' }} style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, color: 'var(--faint)', fontStyle: 'italic', margin: '14px 0' }}>
                IRPP, TFP et FOPROLOS calculés automatiquement depuis les salaires. CNSS et TVA ont chacun leur propre section.
              </div>
              {taxesAuto.length === 0 ? (
                <div className="dec-empty" style={{ padding: '20px 0' }}>
                  <p>Aucune taxe automatique</p>
                  <span>Les taxes apparaîtront dès que des salaires sont saisis.</span>
                </div>
              ) : (
                <table className="dec-table">
                  <thead><tr><th>Taxe</th><th style={{ textAlign: 'right' }}>Montant</th></tr></thead>
                  <tbody>
                    {taxesAuto.map((t) => (<tr key={t.label}><td style={{ fontWeight: 500 }}>{t.label}</td><td className="num">{fmt(t.montant)} TND</td></tr>))}
                    <tr className="total-row"><td>Total à déclarer</td><td className="num">{fmt(totalAuto)} TND</td></tr>
                  </tbody>
                </table>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
