import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EASE_OUT } from '@/lib/framer-motion-constants';
import {
  BarChart3, ChevronRight, CheckCircle2, AlertCircle, Clock,
  Shield, Wallet, CreditCard,
} from 'lucide-react';
import { useMoisCourant } from './MoisContext';
import api from '@/lib/api';
import { calculerFichePaie, isEmployeeActiveInMonth } from './hooks/useSalaires';
import { DEFAULT_RATES } from './hooks/usePayrollRates';
import { DEFAULT_SALARY_ELEMENTS } from './types';
import type { Employee as PayrollEmployee, EmployeeMensuel, SalaryElement } from './types';
import '@/features/clients/clients.css';
import './decaissements.css';

/* ── Helpers ── */
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function fmt0(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const FR_MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
const FR_MONTHS_FULL  = [
  'Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];

function moisLabel(mois: string) {
  const [, m] = mois.split('-').map(Number);
  return FR_MONTHS_FULL[m - 1] ?? '';
}
function currentMoisKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/* ── Quarter logic ── */
function resolveDisplayQuarter(year: number, month: number) {
  switch (month) {
    case 1:  return { q: 4, year: year - 1, isPaymentMonth: true };
    case 4:  return { q: 1, year,           isPaymentMonth: true };
    case 7:  return { q: 2, year,           isPaymentMonth: true };
    case 10: return { q: 3, year,           isPaymentMonth: true };
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

/* ── Calendar types ── */
type EventStatus   = 'paid' | 'partial' | 'overdue' | 'pending';
type EventCategory = 'salaire' | 'charge-fixe' | 'charge-variable' | 'taxe' | 'dette' | 'cnss';

interface CalEvent {
  day:      number;
  label:    string;
  montant:  number;
  category: EventCategory;
  status:   EventStatus;
  href:     string;
}

const CAT_COLOR: Record<EventCategory, string> = {
  'salaire':           '#3b82f6',
  'charge-fixe':       '#8b5cf6',
  'charge-variable':   '#f97316',
  'taxe':              '#d97706',
  'dette':             '#ef4444',
  'cnss':              '#0ea5e9',
};

function dotColor(status: EventStatus, cat: EventCategory) {
  if (status === 'paid')    return '#16a34a';
  if (status === 'overdue') return '#ef4444';
  return CAT_COLOR[cat];
}

/* ── Calendar grid ── */
function buildGrid(year: number, month: number) {
  const firstDow  = new Date(year, month - 1, 1).getDay();
  const startOff  = (firstDow + 6) % 7;
  const daysInMon = new Date(year, month, 0).getDate();
  return { startOff, daysInMon };
}
const DOW_LABELS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

/* ── API types ── */
interface SalaireMensuel {
  id: string;
  employee_id: string;
  mois: string;
  salaire_paye: boolean;
  montant_paye: number;
  bonus?: number;
  acompte?: number;
  jours_absent?: number;
  snap_brut_effectif?: number;
  snap_cnss_salarie?: number;
  snap_irpp_mensuel?: number;
  snap_net_a_payer?: number;
  snap_cout_total?: number;
}

interface ChargeFixeDef {
  id: string;
  label: string;
  montant: number;
  tvaTaux: number;
  jourEcheance: number;
  cycleMonths: number;
  createdAt: string;
  archivedAt: string | null;
}

interface ChargeFixePaiement {
  id: string;
  chargeId: string;
  mois: string;
  montant: number;
}

interface ChargeVariable {
  id: string;
  label: string;
  montant: number;
  tvaTaux: number;
  date: string;
  mois: string;
}

interface Dette {
  id: string;
  creancier: string;
  montantTotal: number;
  montantPaye: number;
  dateEcheance: string | null;
  archivedAt?: string | null;
}

interface CnssTrimestre {
  id?: string;
  annee: number;
  trimestre: number;
  montantSalarie: number;
  montantEmployeur: number;
  montantPenalite: number;
  montantTotal: number;
  datePaiement?: string;
  statut: string;
}

interface YearlyMonthData {
  mois:         string;
  salaires:     number;
  chargesFixes: number;
  chargesVars:  number;
  dettes:       number;
}

/* ── Charge-fixe helpers ── */
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

/* ════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════ */
export default function Overview() {
  const { mois } = useMoisCourant();
  const [view,        setView]        = useState<'mensuel' | 'annuel'>('mensuel');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  /* ── Monthly data state ── */
  const [salaires,       setSalaires]       = useState<SalaireMensuel[]>([]);
  const [chargesFixeDefs, setChargesFixeDefs] = useState<ChargeFixeDef[]>([]);
  const [fixePaiements,  setFixePaiements]  = useState<ChargeFixePaiement[]>([]);
  const [chargesVar,     setChargesVar]     = useState<ChargeVariable[]>([]);
  const [dettes,         setDettes]         = useState<Dette[]>([]);
  const [cnssRecord,     setCnssRecord]     = useState<CnssTrimestre | null>(null);
  const [qSalaires,      setQSalaires]      = useState<Record<string, SalaireMensuel[]>>({});
  const [employees,      setEmployees]      = useState<PayrollEmployee[]>([]);

  /* ── Yearly data state ── */
  const [yearlyData,    setYearlyData]    = useState<YearlyMonthData[]>([]);
  const [yearlyLoading, setYearlyLoading] = useState(false);

  /* ── Derived quarter ── */
  const [yearNum, monthNum] = mois.split('-').map(Number);
  const today               = new Date().getDate();
  const isCurrentMonth      = mois === currentMoisKey();

  const { q: cnssQ, year: cnssYear, isPaymentMonth } = useMemo(
    () => resolveDisplayQuarter(yearNum, monthNum),
    [yearNum, monthNum],
  );
  const qMonths = useMemo(() => getQuarterMonths(cnssQ, cnssYear), [cnssQ, cnssYear]);

  /* ── Load monthly data ── */
  const loadMonthly = useCallback(async () => {
    try {
      const [salRes, fixesRes, varRes, dettesRes, cnssRes, empRes] = await Promise.all([
        api.get<SalaireMensuel[]>(`/api/payroll/salaires?mois=${mois}`).catch(() => ({ data: [] as SalaireMensuel[] })),
        api.get<ChargeFixeDef[]>('/api/charges/fixes').catch(() => ({ data: [] as ChargeFixeDef[] })),
        api.get<ChargeVariable[]>(`/api/charges/variables?mois=${mois}`).catch(() => ({ data: [] as ChargeVariable[] })),
        api.get<Dette[]>('/api/dettes').catch(() => ({ data: [] as Dette[] })),
        api.get<CnssTrimestre>(`/api/cnss/trimestres/${cnssYear}/${cnssQ}`).catch(() => ({ data: null })),
        api.get<PayrollEmployee[]>('/api/employees?includeArchived=true').catch(() => ({ data: [] as PayrollEmployee[] })),
      ]);
      setSalaires(salRes.data ?? []);
      setEmployees(empRes.data ?? []);
      const defs = fixesRes.data ?? [];
      setChargesFixeDefs(defs);
      setChargesVar(varRes.data ?? []);
      setDettes((dettesRes.data ?? []).filter((d) => !d['archivedAt']));
      setCnssRecord(cnssRes.data ?? null);

      // Fetch paiements for each charge fixe
      const paiResults = await Promise.all(
        defs.map((d) =>
          api.get<ChargeFixePaiement[]>(`/api/charges/fixes/${d.id}/paiements`)
            .then((r) => r.data ?? [])
            .catch(() => [] as ChargeFixePaiement[])
        )
      );
      setFixePaiements(paiResults.flat());

      // Fetch quarter salaries (past months)
      const pastMonths = qMonths.filter((m) => m !== mois);
      const qPairs = await Promise.all(
        pastMonths.map((m) =>
          api.get<SalaireMensuel[]>(`/api/payroll/salaires?mois=${m}`)
            .then((r) => [m, r.data ?? []] as [string, SalaireMensuel[]])
            .catch(() => [m, []] as [string, SalaireMensuel[]])
        )
      );
      const qMap: Record<string, SalaireMensuel[]> = {};
      qPairs.forEach(([m, s]) => { qMap[m] = s; });
      setQSalaires(qMap);
    } catch { /* ignore */ }
  }, [mois, cnssQ, cnssYear, qMonths]);

  useEffect(() => { loadMonthly(); }, [loadMonthly]);

  /* ── Load yearly data ── */
  const loadYearly = useCallback(async () => {
    if (view !== 'annuel') return;
    setYearlyLoading(true);
    const year = mois.slice(0, 4);
    try {
      const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
      // Fetch salaires + variables for each month in parallel
      const [salResults, varResults, dettesRes] = await Promise.all([
        Promise.all(months.map((m) =>
          api.get<SalaireMensuel[]>(`/api/payroll/salaires?mois=${m}`)
            .then((r) => ({ mois: m, data: r.data ?? [] }))
            .catch(() => ({ mois: m, data: [] }))
        )),
        Promise.all(months.map((m) =>
          api.get<ChargeVariable[]>(`/api/charges/variables?mois=${m}`)
            .then((r) => ({ mois: m, data: r.data ?? [] }))
            .catch(() => ({ mois: m, data: [] }))
        )),
        api.get<Dette[]>('/api/dettes').catch(() => ({ data: [] as Dette[] })),
      ]);

      // Aggregate charges fixes payments per month (using fixePaiements already loaded)
      // We use the fixePaiements that are already in state

      const allDettes = dettesRes.data ?? [];

      // Fetch dette paiements for each dette to get payment dates
      const dettePaymentResults = await Promise.all(
        allDettes.map((d) =>
          api.get<{ id: string; montant: number; date: string }[]>(`/api/dettes/${d.id}/paiements`)
            .then((r) => r.data ?? [])
            .catch(() => [])
        )
      );
      const allDettePaiements = dettePaymentResults.flat();

      const byMois: Record<string, YearlyMonthData> = {};
      months.forEach((m) => {
        byMois[m] = { mois: m, salaires: 0, chargesFixes: 0, chargesVars: 0, dettes: 0 };
      });

      // Salaires: sum snapCoutTotal for paid salary records
      salResults.forEach(({ mois: m, data }) => {
        data.forEach((s) => {
          if (s.salaire_paye) byMois[m].salaires += s.snap_cout_total ?? 0;
        });
      });

      // Charges variables: sum montant
      varResults.forEach(({ mois: m, data }) => {
        data.forEach((c) => { byMois[m].chargesVars += c.montant; });
      });

      // Charges fixes payments: use already-loaded fixePaiements
      fixePaiements.forEach((p) => {
        if (byMois[p.mois]) byMois[p.mois].chargesFixes += p.montant;
      });

      // Dettes paiements: use payment date
      allDettePaiements.forEach((p) => {
        const key = p.date?.slice(0, 7);
        if (key && byMois[key]) byMois[key].dettes += p.montant;
      });

      setYearlyData(Object.values(byMois));
    } catch { /* ignore */ } finally {
      setYearlyLoading(false);
    }
  }, [view, mois, fixePaiements]);

  useEffect(() => { if (view === 'annuel') loadYearly(); }, [view, loadYearly]);

  /* ── Salary totals ── */
  const salTotaux = useMemo(() => {
    let netPaye = 0, netRestant = 0, coutTotal = 0, masseNette = 0, cnssSal = 0, brut = 0, irpp = 0;
    salaires.forEach((s) => {
      const netAPayer  = s.snap_net_a_payer  ?? 0;
      const paid       = s.montant_paye ?? 0;
      netPaye    += paid;
      netRestant += Math.max(0, netAPayer - paid);
      coutTotal  += s.snap_cout_total   ?? 0;
      masseNette += netAPayer;
      cnssSal    += s.snap_cnss_salarie  ?? 0;
      brut       += s.snap_brut_effectif ?? 0;
      irpp       += s.snap_irpp_mensuel  ?? 0;
    });
    const cnssEmp  = +(brut * 0.1657).toFixed(3);
    const tfp      = +(brut * 0.02).toFixed(3);
    const foprolos = +(brut * 0.01).toFixed(3);
    return {
      netPaye:      +netPaye.toFixed(3),
      netRestant:   +netRestant.toFixed(3),
      coutTotal:    +coutTotal.toFixed(3),
      masseNette:   +masseNette.toFixed(3),
      cnssSalarie:  +cnssSal.toFixed(3),
      cnssEmployeur: cnssEmp,
      brut:          +brut.toFixed(3),
      irpp:          +irpp.toFixed(3),
      tfp,
      foprolos,
    };
  }, [salaires]);

  /* ── ChargesFixes augmented with status ── */
  const chargesFixesForMonth = useMemo(() => {
    return chargesFixeDefs
      .filter((def) => isDueInMonth(def, mois))
      .map((def) => {
        const moisPaies   = fixePaiements.filter((p) => p.chargeId === def.id && p.mois === mois);
        const montantPaye = +moisPaies.reduce((s, p) => s + p.montant, 0).toFixed(3);
        const resteAPayer = +Math.max(0, def.montant - montantPaye).toFixed(3);
        const status: 'payee' | 'partielle' | 'non-payee' =
          resteAPayer <= 0 ? 'payee' : montantPaye > 0 ? 'partielle' : 'non-payee';
        return { ...def, status, montantPaye, resteAPayer };
      });
  }, [chargesFixeDefs, fixePaiements, mois]);

  /* ── Derived totals ── */
  const totalFixes         = useMemo(() => chargesFixesForMonth.reduce((s, c) => s + c.montant, 0), [chargesFixesForMonth]);
  const chargesFixesPaye   = useMemo(() => chargesFixesForMonth.reduce((s, c) => s + c.montantPaye, 0), [chargesFixesForMonth]);
  const chargesFixesRestant= useMemo(() => chargesFixesForMonth.reduce((s, c) => s + c.resteAPayer, 0), [chargesFixesForMonth]);
  const overdueCount       = useMemo(() => {
    if (!isCurrentMonth) return 0;
    return chargesFixesForMonth.filter((c) => c.status !== 'payee' && today > c.jourEcheance).length;
  }, [chargesFixesForMonth, today, isCurrentMonth]);

  const tvaFixes = useMemo(() =>
    chargesFixesForMonth.reduce((s, c) => {
      if (c.tvaTaux <= 0) return s;
      return +(s + c.montant - c.montant / (1 + c.tvaTaux / 100)).toFixed(3);
    }, 0),
  [chargesFixesForMonth]);

  const totalChargesVar  = useMemo(() => chargesVar.reduce((s, c) => s + c.montant, 0), [chargesVar]);
  const totalChargesVarHT = useMemo(() => chargesVar.reduce((s, c) => s + c.montant / (1 + (c.tvaTaux ?? 0) / 100), 0), [chargesVar]);
  const tvaVariables     = +(totalChargesVar - totalChargesVarHT).toFixed(3);
  const tvaTotale        = +(tvaFixes + tvaVariables).toFixed(3);

  const totalDette  = useMemo(() => dettes.reduce((s, d) => s + d.montantTotal, 0), [dettes]);
  const dettePaye   = useMemo(() => dettes.reduce((s, d) => s + d.montantPaye,  0), [dettes]);
  const detteRestant= useMemo(() => dettes.reduce((s, d) => s + Math.max(0, d.montantTotal - d.montantPaye), 0), [dettes]);

  const taxesDu     = +(salTotaux.irpp + salTotaux.tfp + salTotaux.foprolos).toFixed(3);

  const totalDejasPaye = salTotaux.netPaye + chargesFixesPaye;
  const totalRestant   = salTotaux.netRestant + chargesFixesRestant + taxesDu;
  const cnssPaid       = cnssRecord?.statut === 'payee';

  /* ── CNSS month data for the quarter (computed via the payroll engine) ── */
  const cnssMonthData = useMemo(() => {
    return qMonths.map((m) => {
      const monthSals = m === mois ? salaires : (qSalaires[m] ?? []);
      const adjByEmp = new Map<string, SalaireMensuel>();
      for (const s of monthSals) adjByEmp.set(s.employee_id, s);
      const activeEmps = employees.filter((e) => isEmployeeActiveInMonth(e, m));
      let salarie = 0, employeur = 0;
      for (const e of activeEmps) {
        const adj = adjByEmp.get(e.id);
        let mensuel: EmployeeMensuel | undefined;
        if (adj) {
          const elements: SalaryElement[] = DEFAULT_SALARY_ELEMENTS.map((d) => ({ ...d }));
          const bonusEl = elements.find((x) => x.id === 'bonus');
          if (bonusEl && Number(adj.bonus) > 0) { bonusEl.amount = Number(adj.bonus); bonusEl.enabled = true; }
          const acompteEl = elements.find((x) => x.id === 'acompte');
          if (acompteEl && Number(adj.acompte) > 0) { acompteEl.amount = Number(adj.acompte); acompteEl.enabled = true; }
          const absEl = elements.find((x) => x.id === 'absence');
          if (absEl && Number(adj.jours_absent) > 0) { absEl.amount = Number(adj.jours_absent); absEl.enabled = true; }
          mensuel = { employee_id: e.id, mois: m, salary_elements: elements, salaire_paye: false, date_paiement: null };
        }
        const fiche = calculerFichePaie(e, m, DEFAULT_RATES, mensuel);
        salarie   += fiche.cnss_salarie + fiche.solidarity_salarie;
        employeur += fiche.detail_employeur.cnss;
      }
      salarie   = +salarie.toFixed(3);
      employeur = +employeur.toFixed(3);
      const total = +(salarie + employeur).toFixed(3);
      return {
        moisKey: m, label: `${FR_MONTHS_FULL[Number(m.split('-')[1]) - 1]} ${m.split('-')[0]}`,
        salarie, employeur, total, isCurrentMonth: m === mois, employeeCount: activeEmps.length,
      };
    });
  }, [qMonths, mois, salaires, qSalaires, employees]);

  const cnssTotalBrut = useMemo(() =>
    +cnssMonthData.reduce((s, m) => s + m.salarie + m.employeur, 0).toFixed(3),
  [cnssMonthData]);

  /* ── Calendar events ── */
  const calEvents = useMemo((): CalEvent[] => {
    const items: CalEvent[] = [];

    chargesFixesForMonth.forEach((c) => {
      const status: EventStatus =
        c.status === 'payee'     ? 'paid'    :
        c.status === 'partielle' ? 'partial' :
        isCurrentMonth && today > c.jourEcheance ? 'overdue' : 'pending';
      items.push({
        day: c.jourEcheance, label: c.label,
        montant: c.status === 'payee' ? c.montant : c.resteAPayer,
        category: 'charge-fixe', status, href: '/decaissements/charges-fixes',
      });
    });

    chargesVar.forEach((c) => {
      const day = parseInt(c.date.slice(8, 10), 10);
      if (day >= 1 && day <= 31)
        items.push({ day, label: c.label, montant: c.montant, category: 'charge-variable', status: 'paid', href: '/decaissements/charges-variables' });
    });

    if (salTotaux.coutTotal > 0) {
      const status: EventStatus = salTotaux.netRestant === 0 ? 'paid' : (isCurrentMonth && today > 28 ? 'overdue' : 'pending');
      items.push({ day: 28, label: `Salaires (${salaires.length} emp.)`, montant: salTotaux.coutTotal, category: 'salaire', status, href: '/decaissements/salaires' });
    }

    dettes.forEach((d) => {
      if (!d.dateEcheance || d.dateEcheance.slice(0, 7) !== mois) return;
      const day     = parseInt(d.dateEcheance.slice(8, 10), 10);
      const restant = d.montantTotal - d.montantPaye;
      const status: EventStatus = restant <= 0 ? 'paid' : (isCurrentMonth && today > day ? 'overdue' : 'pending');
      items.push({ day, label: d.creancier, montant: restant > 0 ? restant : d.montantTotal, category: 'dette', status, href: '/decaissements/dettes' });
    });

    if (isPaymentMonth) {
      const status: EventStatus = cnssPaid ? 'paid' : (isCurrentMonth && today > 25 ? 'overdue' : 'pending');
      items.push({ day: 25, label: `CNSS T${cnssQ} ${cnssYear}`, montant: cnssTotalBrut, category: 'cnss', status, href: '/decaissements/etat' });
    }

    return items.sort((a, b) => a.day - b.day);
  }, [chargesFixesForMonth, chargesVar, salaires, salTotaux, dettes, mois, today, isCurrentMonth, isPaymentMonth, cnssPaid, cnssQ, cnssYear, cnssTotalBrut]);

  const eventsByDay = useMemo(() => {
    const m: Record<number, CalEvent[]> = {};
    calEvents.forEach((e) => { if (!m[e.day]) m[e.day] = []; m[e.day].push(e); });
    return m;
  }, [calEvents]);

  const { startOff, daysInMon } = buildGrid(yearNum, monthNum);
  const totalCells = Math.ceil((startOff + daysInMon) / 7) * 7;

  const listEvents = useMemo(() =>
    selectedDay !== null ? (eventsByDay[selectedDay] ?? []) : calEvents,
  [selectedDay, calEvents, eventsByDay]);

  /* ── Category progress ── */
  const categories = useMemo(() => [
    { label: 'Salaires',          total: salTotaux.masseNette, paid: salTotaux.netPaye,    remaining: salTotaux.netRestant,  color: '#3b82f6', href: '/decaissements/salaires'          },
    { label: 'Charges fixes',     total: totalFixes,           paid: chargesFixesPaye,      remaining: chargesFixesRestant,   color: '#8b5cf6', href: '/decaissements/charges-fixes'     },
    { label: 'Charges variables', total: totalChargesVar,      paid: totalChargesVar,       remaining: 0,                     color: '#f97316', href: '/decaissements/charges-variables' },
    { label: 'Taxes',             total: taxesDu,              paid: 0,                     remaining: taxesDu,               color: '#d97706', href: '/decaissements/etat'              },
    { label: 'Dettes',            total: totalDette,           paid: dettePaye,             remaining: detteRestant,          color: '#ef4444', href: '/decaissements/dettes'            },
  ], [salTotaux, totalFixes, chargesFixesPaye, chargesFixesRestant, totalChargesVar, taxesDu, totalDette, dettePaye, detteRestant]);

  /* ── Yearly ── */
  const yearMax = useMemo(() =>
    Math.max(...yearlyData.map((d) => d.salaires + d.chargesFixes + d.chargesVars + d.dettes), 1),
  [yearlyData]);
  const yearTotals = useMemo(() => ({
    sal:  yearlyData.reduce((s, d) => s + d.salaires,    0),
    fix:  yearlyData.reduce((s, d) => s + d.chargesFixes,0),
    vars: yearlyData.reduce((s, d) => s + d.chargesVars, 0),
    det:  yearlyData.reduce((s, d) => s + d.dettes,      0),
  }), [yearlyData]);

  /* ════════════════════════ RENDER ════════════════════════ */
  return (
    <>
      {/* Header + toggle */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div className="dec-header" style={{ margin: 0 }}>
          <h2 className="dec-title">Vue d'ensemble</h2>
          <p className="dec-subtitle">
            {view === 'mensuel' ? `${moisLabel(mois)} ${mois.slice(0, 4)}` : `Année ${mois.slice(0, 4)}`}
          </p>
        </div>
        <motion.div className="sal-tabs-wrap" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ alignSelf: 'center' }}>
          <div className="sal-tabs-pill">
            {(['mensuel', 'annuel'] as const).map((v) => (
              <motion.button key={v} className={`sal-pill-btn${view === v ? ' active' : ''}`} onClick={() => setView(v)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                {v === 'mensuel' ? 'Mensuel' : 'Annuel'}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ══════════ MONTHLY ══════════ */}
      {view === 'mensuel' && (
        <>
          {/* Stats row */}
          <div className="dec-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', marginBottom: 20 }}>

            {/* Déjà réglé */}
            <motion.div className="dec-stat dec-stat--green" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
              <div className="dec-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={10} /> Déjà réglé
              </div>
              <div className="dec-stat-value">{fmt(totalDejasPaye)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>TND</span></div>
            </motion.div>

            {/* Restant */}
            <motion.div className={`dec-stat${totalRestant > 0 ? ' dec-stat--red' : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}>
              <div className="dec-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={10} /> Restant à payer
              </div>
              <div className="dec-stat-value">{fmt(totalRestant)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>TND</span></div>
              {overdueCount > 0 && <div className="dec-stat-delta negative">{overdueCount} en retard</div>}
            </motion.div>

            {/* Dettes */}
            <motion.div className="dec-stat dec-stat--red" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
              <div className="dec-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <CreditCard size={10} /> Dettes restantes
              </div>
              <div className="dec-stat-value">{fmt(detteRestant)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>TND</span></div>
            </motion.div>

            {/* TVA */}
            <motion.div className="dec-stat dec-stat--amber" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }}>
              <div className="dec-stat-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Wallet size={10} /> TVA sur charges
              </div>
              <div className="dec-stat-value">{fmt(tvaTotale)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>TND</span></div>
              <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ch. fixes</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmt(tvaFixes)}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ch. variables</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{fmt(tvaVariables)}</span>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Two-column: progress + calendar */}
          <div className="ovw-grid">

            {/* LEFT: Répartition */}
            <div className="dec-card">
              <div className="dec-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={15} style={{ color: 'var(--accent)' }} /> Répartition des charges
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {categories.map((cat, i) => {
                  const pct = cat.total > 0 ? Math.min(100, Math.round((cat.paid / cat.total) * 100)) : 0;
                  return (
                    <motion.div key={cat.label} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}>
                      <Link to={cat.href} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <div style={{ width: 8, height: 8, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{cat.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {cat.remaining > 0 && (
                              <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, background: 'rgba(239,68,68,0.08)', padding: '1px 7px', borderRadius: 999 }}>
                                −{fmt(cat.remaining)}
                              </span>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>{fmt(cat.total)} TND</span>
                            <ChevronRight size={12} style={{ color: 'var(--faint)' }} />
                          </div>
                        </div>
                        <div style={{ height: 7, background: 'var(--surface)', borderRadius: 999, overflow: 'hidden' }}>
                          <motion.div style={{ height: '100%', background: cat.color, borderRadius: 999 }}
                            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.7, delay: i * 0.07, ease: EASE_OUT }} />
                        </div>
                        <div style={{ marginTop: 4, fontSize: 10, color: pct === 100 ? '#16a34a' : 'var(--faint)', fontWeight: 600 }}>
                          {pct === 100 ? '✓ Tout réglé' : `${pct}% réglé`}
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT: Calendar */}
            <div className="dec-card" style={{ padding: '18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{moisLabel(mois)} {mois.slice(0, 4)}</span>
                <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--muted)' }}>
                  {[{ label: 'Payé', color: '#16a34a' }, { label: 'À venir', color: '#8b5cf6' }, { label: 'En retard', color: '#ef4444' }].map((l) => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: l.color }} />{l.label}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
                {DOW_LABELS.map((d) => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--faint)', padding: '2px 0', letterSpacing: '0.04em' }}>{d}</div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 14 }}>
                {Array.from({ length: totalCells }).map((_, idx) => {
                  const dayNum    = idx - startOff + 1;
                  const isValid   = dayNum >= 1 && dayNum <= daysInMon;
                  const isToday   = isValid && isCurrentMonth && dayNum === today;
                  const isSel     = isValid && selectedDay === dayNum;
                  const dayEvts   = isValid ? (eventsByDay[dayNum] ?? []) : [];
                  const hasOverdue = dayEvts.some((e) => e.status === 'overdue');
                  const dotColors  = Array.from(new Set(dayEvts.slice(0, 3).map((e) => dotColor(e.status, e.category))));

                  return (
                    <motion.div key={idx}
                      whileHover={isValid && dayEvts.length > 0 ? { scale: 1.08 } : {}}
                      whileTap={isValid  && dayEvts.length > 0 ? { scale: 0.95 } : {}}
                      onClick={() => { if (!isValid || dayEvts.length === 0) return; setSelectedDay(selectedDay === dayNum ? null : dayNum); }}
                      style={{
                        borderRadius: 8, padding: '5px 2px 4px', textAlign: 'center',
                        cursor: isValid && dayEvts.length > 0 ? 'pointer' : 'default',
                        background: isSel ? 'var(--accent-bg, rgba(232,98,26,0.12))' : isToday ? 'var(--surface)' : 'transparent',
                        border: isSel ? '1.5px solid var(--accent)' : isToday ? '1.5px solid var(--border)' : '1.5px solid transparent',
                        transition: 'background 0.12s', minHeight: 42,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', gap: 3,
                      }}
                    >
                      {isValid && (
                        <>
                          <span style={{ fontSize: 12, fontWeight: isToday ? 800 : isSel ? 700 : 400, lineHeight: 1.2,
                            color: isSel ? 'var(--accent)' : hasOverdue ? '#ef4444' : 'var(--text)' }}>
                            {dayNum}
                          </span>
                          {dotColors.length > 0 && (
                            <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                              {dotColors.map((c, di) => <div key={di} style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />)}
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              <div style={{ height: 1, background: 'var(--border-light, var(--border))', marginBottom: 12 }} />

              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                {selectedDay !== null ? `${selectedDay} ${moisLabel(mois)}` : 'Tous les événements'}
                {selectedDay !== null && (
                  <button onClick={() => setSelectedDay(null)}
                    style={{ marginLeft: 8, fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Tout voir ×
                  </button>
                )}
              </div>

              {listEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--muted)', fontSize: 12 }}>
                  <CheckCircle2 size={22} style={{ margin: '0 auto 6px', display: 'block', color: '#16a34a', opacity: 0.7 }} />
                  Aucun événement
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                  {listEvents.map((ev, i) => {
                    const dc = dotColor(ev.status, ev.category);
                    const statusLabel = ev.status === 'paid' ? 'Payé' : ev.status === 'partial' ? 'Partiel' : ev.status === 'overdue' ? 'En retard' : 'À payer';
                    return (
                      <motion.div key={i} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                        <Link to={ev.href} style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px',
                          borderRadius: 10, textDecoration: 'none',
                          background: ev.status === 'overdue' ? 'rgba(239,68,68,0.05)' : 'var(--surface)',
                          border: `1px solid ${ev.status === 'overdue' ? 'rgba(239,68,68,0.15)' : 'transparent'}`,
                        }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: dc, opacity: ev.status === 'paid' ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{ev.day}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.label}</div>
                            <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, color: dc, fontWeight: 600 }}>
                              {ev.status === 'paid'    && <CheckCircle2 size={9} />}
                              {ev.status === 'overdue' && <AlertCircle  size={9} />}
                              {ev.status === 'pending' && <Clock        size={9} />}
                              {statusLabel}
                            </div>
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', flexShrink: 0, textAlign: 'right' }}>
                            {fmt(ev.montant)}<div style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 400 }}>TND</div>
                          </div>
                        </Link>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── CNSS Quarter Card ── */}
          <motion.div className="dec-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ marginTop: 0 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                  background: cnssPaid ? 'rgba(22,163,74,0.1)' : isPaymentMonth ? 'rgba(239,68,68,0.1)' : 'rgba(14,165,233,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Shield size={20} style={{ color: cnssPaid ? '#16a34a' : isPaymentMonth ? '#ef4444' : '#0ea5e9' }} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>CNSS — T{cnssQ} {cnssYear}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {cnssMonthData.map((m) => m.label).join(' · ')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: '5px 14px', borderRadius: 999,
                  background: cnssPaid ? 'rgba(22,163,74,0.1)' : isPaymentMonth ? 'rgba(239,68,68,0.1)' : 'rgba(14,165,233,0.1)',
                  color: cnssPaid ? '#16a34a' : isPaymentMonth ? '#ef4444' : '#0ea5e9',
                }}>
                  {cnssPaid ? '✓ Payée' : isPaymentMonth ? 'Due ce mois' : 'En cours'}
                </span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                    {fmt(cnssTotalBrut)}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>TND</span>
                  </div>
                  {cnssPaid && cnssRecord?.datePaiement && (
                    <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
                      Payée le {new Date(cnssRecord.datePaiement).toLocaleDateString('fr-FR')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly breakdown — 3 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: cnssPaid || !isPaymentMonth ? 0 : 14 }}>
              {cnssMonthData.map((m, i) => (
                <motion.div key={m.moisKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.07 }}
                  style={{
                    background: 'var(--surface)', borderRadius: 14, padding: '12px 14px',
                    border: m.isCurrentMonth ? '1.5px solid #0ea5e9' : '1px solid var(--border-light, var(--border))',
                  }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: m.isCurrentMonth ? '#0ea5e9' : 'var(--muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {m.label}
                    {m.isCurrentMonth && <span style={{ fontSize: 9, background: '#0ea5e9', color: '#fff', padding: '1px 6px', borderRadius: 999 }}>actuel</span>}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 8 }}>
                    {fmt(m.total)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginLeft: 3 }}>TND</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { label: 'Part salarié',  value: m.salarie,   color: '#3b82f6' },
                      { label: 'Part patronale', value: m.employeur, color: '#0ea5e9' },
                    ].map((row) => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{row.label}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{fmt(row.value)}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Payment month alert */}
            {isPaymentMonth && !cnssPaid && (
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 12,
                background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, flex: 1 }}>
                  Ce mois est un mois de paiement CNSS. Le trimestre T{cnssQ} doit être réglé.
                </span>
                <Link to="/decaissements/etat" style={{ fontSize: 12, color: '#ef4444', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', background: 'rgba(239,68,68,0.1)', padding: '4px 10px', borderRadius: 8 }}>
                  Payer →
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* ══════════ YEARLY VIEW ══════════ */}
      {view === 'annuel' && (
        <>
          {yearlyLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 14 }}>
              Chargement des données annuelles…
            </div>
          ) : (
            <>
              <div className="dec-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', marginBottom: 20 }}>
                {[
                  { label: 'Total annuel',        value: yearTotals.sal + yearTotals.fix + yearTotals.vars + yearTotals.det, mod: '' },
                  { label: 'Salaires versés',      value: yearTotals.sal,  mod: ' dec-stat--blue' },
                  { label: 'Charges fixes payées', value: yearTotals.fix,  mod: '' },
                  { label: 'Charges variables',    value: yearTotals.vars, mod: '' },
                  { label: 'Paiements dettes',     value: yearTotals.det,  mod: ' dec-stat--red' },
                ].map((s, i) => (
                  <motion.div key={s.label} className={`dec-stat${s.mod}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <div className="dec-stat-label">{s.label}</div>
                    <div className="dec-stat-value" style={{ fontSize: 16 }}>
                      {fmt(s.value)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)', marginLeft: 4 }}>TND</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="dec-card" style={{ marginBottom: 16 }}>
                <div className="dec-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <BarChart3 size={15} style={{ color: 'var(--accent)' }} />
                  Décaissements mensuels — {mois.slice(0, 4)}
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, fontSize: 11 }}>
                    {[{ label: 'Salaires', color: '#3b82f6' }, { label: 'Ch. fixes', color: '#8b5cf6' }, { label: 'Ch. variables', color: '#f97316' }, { label: 'Dettes', color: '#ef4444' }].map((l) => (
                      <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 9, height: 9, borderRadius: 3, background: l.color }} />
                        <span style={{ color: 'var(--muted)', fontWeight: 500 }}>{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 200, paddingTop: 8 }}>
                  {yearlyData.map((d, i) => {
                    const isCurrent = d.mois === mois;
                    const segments  = [
                      { val: d.salaires,    color: '#3b82f6' },
                      { val: d.chargesFixes,color: '#8b5cf6' },
                      { val: d.chargesVars, color: '#f97316' },
                      { val: d.dettes,      color: '#ef4444' },
                    ].filter((s) => s.val > 0);
                    const total = d.salaires + d.chargesFixes + d.chargesVars + d.dettes;
                    return (
                      <motion.div key={d.mois} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                        title={`${FR_MONTHS_FULL[i]}: ${fmt(total)} TND`}>
                        <div style={{ width: '100%', height: 170, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1 }}>
                          {segments.map((seg, si) => (
                            <motion.div key={si} style={{ width: '100%', background: seg.color, opacity: isCurrent ? 1 : 0.65, borderRadius: si === segments.length - 1 ? '4px 4px 0 0' : 0 }}
                              initial={{ height: 0 }} animate={{ height: Math.max(3, (seg.val / yearMax) * 170) }}
                              transition={{ duration: 0.55, delay: i * 0.04 + si * 0.02, ease: EASE_OUT }} />
                          ))}
                          {total === 0 && <div style={{ width: '100%', height: 3, background: 'var(--border)', borderRadius: 2 }} />}
                        </div>
                        <div style={{ fontSize: 10, color: isCurrent ? 'var(--accent)' : 'var(--muted)', fontWeight: isCurrent ? 800 : 400 }}>{FR_MONTHS_SHORT[i]}</div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="dec-card">
                <div className="dec-card-title">Détail mensuel</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="dec-table" style={{ minWidth: 580 }}>
                    <thead>
                      <tr>
                        <th>Mois</th>
                        <th style={{ color: '#3b82f6' }}>Salaires</th>
                        <th style={{ color: '#8b5cf6' }}>Ch. fixes</th>
                        <th style={{ color: '#f97316' }}>Ch. variables</th>
                        <th style={{ color: '#ef4444' }}>Dettes</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yearlyData.map((d, i) => {
                        const total     = d.salaires + d.chargesFixes + d.chargesVars + d.dettes;
                        const isCurrent = d.mois === mois;
                        return (
                          <motion.tr key={d.mois} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                            style={{ background: isCurrent ? 'var(--accent-bg, rgba(232,98,26,0.05))' : undefined }}>
                            <td style={{ fontWeight: isCurrent ? 700 : 500, color: isCurrent ? 'var(--accent)' : 'var(--text)' }}>
                              {FR_MONTHS_FULL[i]}
                              {isCurrent && <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: 999 }}>actuel</span>}
                            </td>
                            <td style={{ color: d.salaires     > 0 ? '#3b82f6' : 'var(--faint)', fontWeight: d.salaires     > 0 ? 600 : 400 }}>{d.salaires     > 0 ? `${fmt(d.salaires)} TND`     : '—'}</td>
                            <td style={{ color: d.chargesFixes > 0 ? '#8b5cf6' : 'var(--faint)', fontWeight: d.chargesFixes > 0 ? 600 : 400 }}>{d.chargesFixes > 0 ? `${fmt(d.chargesFixes)} TND`  : '—'}</td>
                            <td style={{ color: d.chargesVars  > 0 ? '#f97316' : 'var(--faint)', fontWeight: d.chargesVars  > 0 ? 600 : 400 }}>{d.chargesVars  > 0 ? `${fmt(d.chargesVars)} TND`   : '—'}</td>
                            <td style={{ color: d.dettes       > 0 ? '#ef4444' : 'var(--faint)', fontWeight: d.dettes       > 0 ? 600 : 400 }}>{d.dettes       > 0 ? `${fmt(d.dettes)} TND`       : '—'}</td>
                            <td style={{ fontWeight: 700, color: total > 0 ? 'var(--text)' : 'var(--faint)' }}>{total > 0 ? `${fmt(total)} TND` : '—'}</td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td style={{ fontWeight: 700 }}>Total {mois.slice(0, 4)}</td>
                        <td style={{ color: '#3b82f6', fontWeight: 700 }}>{yearTotals.sal  > 0 ? `${fmt(yearTotals.sal)} TND`  : '—'}</td>
                        <td style={{ color: '#8b5cf6', fontWeight: 700 }}>{yearTotals.fix  > 0 ? `${fmt(yearTotals.fix)} TND`  : '—'}</td>
                        <td style={{ color: '#f97316', fontWeight: 700 }}>{yearTotals.vars > 0 ? `${fmt(yearTotals.vars)} TND` : '—'}</td>
                        <td style={{ color: '#ef4444', fontWeight: 700 }}>{yearTotals.det  > 0 ? `${fmt(yearTotals.det)} TND`  : '—'}</td>
                        <td style={{ fontWeight: 800 }}>{fmt(yearTotals.sal + yearTotals.fix + yearTotals.vars + yearTotals.det)} TND</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
