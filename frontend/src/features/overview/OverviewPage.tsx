import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';
import { DatePicker } from '@/components/ui/date-picker';
import GlowCard from '@/components/GlowCard';
import api from '@/lib/api';
import { calculerFichePaie, isEmployeeActiveInMonth } from '@/features/decaissements/hooks/useSalaires';
import { DEFAULT_RATES } from '@/features/decaissements/hooks/usePayrollRates';
import { DEFAULT_SALARY_ELEMENTS } from '@/features/decaissements/types';
import type { Employee as PayrollEmployee, EmployeeMensuel, SalaryElement } from '@/features/decaissements/types';
import './overview.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const first = `${ym}-01`;
  const last  = `${ym}-${new Date(y, m, 0).getDate().toString().padStart(2, '0')}`;
  return { first, last };
}

function fmtCurrency(n: number) {
  return n.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentYM() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function daysDiff(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

// ── Movement / data types ─────────────────────────────────────────────────────

type MovementType = 'facture' | 'autre-revenu' | 'salaire' | 'charge-fixe' | 'charge-variable' | 'dette';

interface Movement {
  id:        string;
  date:      string;
  type:      MovementType;
  label:     string;
  amount:    number;
  direction: 'in' | 'out';
  dueDate?:  string;
  href:      string;
}

interface MonthData {
  encaissements: number;
  decaissements: number;
  breakdown: {
    factures:        number;
    autresRevenus:   number;
    salaires:        number;
    chargesFixes:    number;
    chargesVariables:number;
    dettes:          number;
  };
}

interface Reminder {
  id:        string;
  label:     string;
  amount:    number;
  dueDate?:  string;
  type:      'invoice' | 'debt' | 'charge' | 'salary';
  urgency:   'overdue' | 'soon' | 'upcoming';
  direction: 'in' | 'out';
  href:      string;
}

interface ChargeReporteeItem {
  defId:      string;
  label:      string;
  monthsLate: number;
  totalDue:   number;
  href:       string;
}

interface CnssOverviewData {
  q:             number;
  year:          number;
  qLabel:        string;
  qMonthsLabel:  string;
  deadlineLabel: string;
  isPaid:        boolean;
  paidAmount:    number;
  paidDate:      string | null;
  penalty:       number;
  totalSalarie:  number;
  totalEmployeur:number;
  totalBrut:     number;
  isOverdue:     boolean;
  daysLeft:      number;
  monthsLate:    number;
}

interface SummaryData {
  chargesReportees: ChargeReporteeItem[];
  cnss:   CnssOverviewData;
  dettes: { total: number; paye: number; restant: number };
}

// ── API types ─────────────────────────────────────────────────────────────────

interface SalaireMensuel {
  id: string;
  employee_id: string;
  mois: string;
  salaire_paye: boolean;
  montant_paye?: number;
  bonus?: number;
  acompte?: number;
  jours_absent?: number;
  snap_brut_effectif?: number;
  snap_cnss_salarie?: number;
  snap_net_a_payer?: number;
  snap_cout_total?: number;
  date_paiement?: string;
}

interface Employee {
  id: string;
  nom: string;
  prenom: string;
  dateEmbauche?: string;
  dateSortie?: string | null;
  archivedAt?: string | null;
}

interface ChargeFixeDef {
  id: string;
  groupId: string;
  label: string;
  montant: number;
  jourEcheance: number | null;
  createdAt: string;
  archivedAt: string | null;
}

interface ChargeFixePaiement {
  id: string;
  chargeId: string;
  mois: string;
  montant: number;
  datePaiement?: string;
}

interface ChargeVariable {
  id: string;
  label: string;
  montant: number;
  date: string;
  mois: string;
}

interface DetteRow {
  id: string;
  creancier: string;
  montantTotal: number;
  montantPaye: number;
  dateEcheance: string | null;
  archivedAt?: string | null;
}

interface DettePaiement {
  id: string;
  detteId: string;
  montant: number;
  date: string;
}

interface AutreRevenu {
  id: string;
  label?: string;
  description?: string;
  montant: number;
  date: string;
}

interface CnssTrimestre {
  id?: string;
  annee: number;
  trimestre: number;
  statut?: 'due' | 'payee' | string;
  montantTotal?: number;
  montantSalarie?: number;
  montantEmployeur?: number;
  montantPenalite?: number;
  datePaiement?: string | null;
}

// ── CNSS quarter helpers ──────────────────────────────────────────────────────

const FR_MONTHS_SHORT = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];

function resolveDisplayQuarter(year: number, month: number): { q: number; year: number } {
  switch (month) {
    case 1:  return { q: 4, year: year - 1 };
    case 4:  return { q: 1, year };
    case 7:  return { q: 2, year };
    case 10: return { q: 3, year };
    default: return { q: Math.ceil(month / 3), year };
  }
}

function cnssQuarterInfo(q: number, year: number) {
  const startMonth = (q - 1) * 3 + 1;
  const qMonths = [0, 1, 2].map((i) => {
    const m = startMonth + i;
    return `${year}-${String(m).padStart(2, '0')}`;
  });
  const qMonthsLabel = qMonths.map((m) => FR_MONTHS_SHORT[Number(m.split('-')[1]) - 1]).join(' · ');

  const deadlineMonthIdx = [3, 6, 9, 0][q - 1];
  const deadlineYear     = q === 4 ? year + 1 : year;
  const deadline         = new Date(deadlineYear, deadlineMonthIdx, 15);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isOverdue = today > deadline;
  const daysLeft  = Math.ceil((deadline.getTime() - today.getTime()) / 86_400_000);
  let monthsLate = 0;
  if (isOverdue) {
    monthsLate = (today.getFullYear() - deadline.getFullYear()) * 12 + (today.getMonth() - deadline.getMonth());
    if (today.getDate() < 15) monthsLate = Math.max(0, monthsLate - 1);
    monthsLate = Math.max(1, monthsLate);
  }

  return {
    qMonths, qMonthsLabel,
    deadlineLabel: deadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
    isOverdue, daysLeft, monthsLate,
  };
}

// ── Data fetching (REST) ──────────────────────────────────────────────────────

async function safeGet<T>(url: string, fallback: T): Promise<T> {
  try {
    const r = await api.get<T>(url);
    return (r.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

async function fetchSummaryData(): Promise<SummaryData> {
  const now    = new Date();
  const nowYM  = currentYM();
  const { q, year } = resolveDisplayQuarter(now.getFullYear(), now.getMonth() + 1);
  const { qMonths, qMonthsLabel, deadlineLabel, isOverdue, daysLeft, monthsLate } = cnssQuarterInfo(q, year);

  const [allDefs, cnssRecord, dettesAll] = await Promise.all([
    safeGet<ChargeFixeDef[]>('/api/charges/fixes?includeArchived=true', []),
    safeGet<CnssTrimestre | null>(`/api/cnss/trimestres/${year}/${q}`, null),
    safeGet<DetteRow[]>('/api/dettes', []),
  ]);

  // Paiements per charge fixe def (one request each — same as decaissements/Overview).
  const allPayments: ChargeFixePaiement[] = (
    await Promise.all(allDefs.map((d) => safeGet<ChargeFixePaiement[]>(`/api/charges/fixes/${d.id}/paiements`, [])))
  ).flat();

  const paidMap = new Map<string, number>();
  for (const p of allPayments) {
    const key = `${p.chargeId}:${p.mois}`;
    paidMap.set(key, (paidMap.get(key) ?? 0) + Number(p.montant ?? 0));
  }

  const byGroup = new Map<string, ChargeFixeDef[]>();
  for (const def of allDefs) {
    if (!byGroup.has(def.groupId)) byGroup.set(def.groupId, []);
    byGroup.get(def.groupId)!.push(def);
  }

  const chargesReportees: ChargeReporteeItem[] = [];
  for (const [, defs] of byGroup) {
    const current = defs.find((d) => !d.archivedAt);
    if (!current) continue;

    let lateCount = 0;
    let totalDue  = 0;

    for (const def of defs) {
      const startMois = def.createdAt.slice(0, 7);
      const endMois   = def.archivedAt ? def.archivedAt.slice(0, 7) : nowYM;
      let m = startMois;
      while (m < endMois && m < nowYM) {
        const paid      = paidMap.get(`${def.id}:${m}`) ?? 0;
        const remaining = Math.max(0, Number(def.montant) - paid);
        if (remaining > 0) { totalDue += remaining; lateCount++; }
        const [y, mo] = m.split('-').map(Number);
        const d = new Date(y, mo, 1);
        m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
    }

    if (lateCount > 0) {
      chargesReportees.push({
        defId:      current.id,
        label:      current.label,
        monthsLate: lateCount,
        totalDue:   +totalDue.toFixed(3),
        href:       `${ROUTES.app.decaissements.chargesFixes}?id=${current.id}`,
      });
    }
  }
  chargesReportees.sort((a, b) => b.totalDue - a.totalDue);

  // ── CNSS amounts: compute via the payroll engine for each active employee over
  //    every quarter month (mirrors the source project's overview computation).
  //    The snap_* snapshots are NOT used — they are 0 until a salary is calculated.
  const [employeesPay, qSalairesArrays] = await Promise.all([
    safeGet<PayrollEmployee[]>('/api/employees?includeArchived=true', []),
    Promise.all(qMonths.map((m) => safeGet<SalaireMensuel[]>(`/api/payroll/salaires?mois=${m}`, []))),
  ]);
  // Index monthly adjustments (bonus / acompte / jours_absent) by month+employee.
  const adjMap = new Map<string, SalaireMensuel>();
  qMonths.forEach((m, i) => {
    for (const s of qSalairesArrays[i] ?? []) adjMap.set(`${m}:${s.employee_id}`, s);
  });
  let totalSalarie = 0;
  let totalEmployeur = 0;
  for (const m of qMonths) {
    if (m > nowYM) continue; // don't estimate future months
    for (const e of employeesPay) {
      if (!isEmployeeActiveInMonth(e, m)) continue;
      const adj = adjMap.get(`${m}:${e.id}`);
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
      totalSalarie   += fiche.cnss_salarie + fiche.solidarity_salarie;
      totalEmployeur += fiche.detail_employeur.cnss;
    }
  }
  totalSalarie   = +totalSalarie.toFixed(3);
  totalEmployeur = +totalEmployeur.toFixed(3);

  const isPaid = cnssRecord?.statut === 'payee';

  const dettesRows  = (dettesAll ?? []).filter((d) => !d.archivedAt);
  const dettesTotal = dettesRows.reduce((s, d) => s + (Number(d.montantTotal) || 0), 0);
  const dettesPaye  = dettesRows.reduce((s, d) => s + (Number(d.montantPaye)  || 0), 0);

  return {
    chargesReportees,
    cnss: {
      q, year,
      qLabel:        `T${q} ${year}`,
      qMonthsLabel,
      deadlineLabel,
      isPaid,
      paidAmount:    isPaid ? +Number(cnssRecord!.montantTotal ?? 0).toFixed(3) : 0,
      paidDate:      isPaid ? (cnssRecord!.datePaiement ?? null) : null,
      penalty:       isPaid ? +Number(cnssRecord!.montantPenalite ?? 0).toFixed(3) : 0,
      totalSalarie,
      totalEmployeur,
      totalBrut:     +(totalSalarie + totalEmployeur).toFixed(3),
      isOverdue,
      daysLeft,
      monthsLate,
    },
    dettes: { total: +dettesTotal.toFixed(3), paye: +dettesPaye.toFixed(3), restant: +(dettesTotal - dettesPaye).toFixed(3) },
  };
}

async function fetchPriorBalance(ym: string): Promise<number> {
  // Approximation: sum all salaire/charge/dette/revenu rows strictly before this month.
  // (Invoices payment_partials not available in this backend yet.)
  const before = `${ym}-01`;

  const [autres, allVars, dettes, allFixesPaiements, allSalairesByMonth, paymentsRaw] = await Promise.all([
    safeGet<AutreRevenu[]>(`/api/autres-revenus?to=${before}`, []),
    safeGet<ChargeVariable[]>('/api/charges/variables', []),
    safeGet<DetteRow[]>('/api/dettes', []),
    (async () => {
      const defs = await safeGet<ChargeFixeDef[]>('/api/charges/fixes?includeArchived=true', []);
      const pays = await Promise.all(defs.map((d) => safeGet<ChargeFixePaiement[]>(`/api/charges/fixes/${d.id}/paiements`, [])));
      return pays.flat();
    })(),
    (async () => {
      // Load salaires for the past 18 months as a reasonable window.
      const months: string[] = [];
      const [y, m] = ym.split('-').map(Number);
      for (let i = 1; i <= 18; i++) {
        const d = new Date(y, m - 1 - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
      const arrays = await Promise.all(months.map((mm) => safeGet<SalaireMensuel[]>(`/api/payroll/salaires?mois=${mm}`, [])));
      return arrays.flat();
    })(),
    safeGet<Record<string, unknown>[]>(`/api/payments?to=${before}`, []),
  ]);

  const autresAmt = (autres ?? []).filter((r) => r.date < before).reduce((s, r) => s + Number(r.montant || 0), 0);
  const varsAmt   = (allVars ?? []).filter((v) => v.date < before).reduce((s, v) => s + Number(v.montant || 0), 0);

  // Factures encaissées avant ce mois (date d'émission < début du mois).
  const facturesAmt = (paymentsRaw ?? [])
    .filter((p) => String((p.dateIssued ?? p.date_issued ?? '')).slice(0, 10) < before)
    .reduce((s, p) => {
      const status = String(p.status ?? '');
      const ttc  = Number(p.totalTtc   ?? p.total_ttc   ?? 0);
      const paid = Number(p.amountPaid ?? p.amount_paid ?? 0);
      if (status === 'paid')    return s + ttc;
      if (status === 'partial') return s + paid;
      return s;
    }, 0);

  // Dettes paiements (per-debt fetch)
  const detteIds = (dettes ?? []).map((d) => d.id);
  const dettePayLists = await Promise.all(detteIds.map((id) => safeGet<DettePaiement[]>(`/api/dettes/${id}/paiements`, [])));
  const dettePayAmt = dettePayLists.flat().filter((p) => p.date < before).reduce((s, p) => s + Number(p.montant || 0), 0);

  const fixesAmt = (allFixesPaiements ?? []).filter((p) => (p.datePaiement ?? '').slice(0, 10) < before).reduce((s, p) => s + Number(p.montant || 0), 0);
  const salairesAmt = (allSalairesByMonth ?? [])
    .filter((s) => s.salaire_paye && (s.date_paiement ?? '').slice(0, 10) < before)
    .reduce((s, sm) => s + Number(sm.snap_net_a_payer ?? sm.montant_paye ?? 0), 0);

  const enc = autresAmt + facturesAmt;
  const dec = salairesAmt + fixesAmt + varsAmt + dettePayAmt;
  return enc - dec;
}

async function fetchMonthData(ym: string): Promise<MonthData> {
  const { first, last } = monthRange(ym);

  const [autres, vars, salaires, allDefs, allDettes, paymentsRaw] = await Promise.all([
    safeGet<AutreRevenu[]>(`/api/autres-revenus?from=${first}&to=${last}`, []),
    safeGet<ChargeVariable[]>(`/api/charges/variables?mois=${ym}`, []),
    safeGet<SalaireMensuel[]>(`/api/payroll/salaires?mois=${ym}`, []),
    safeGet<ChargeFixeDef[]>('/api/charges/fixes?includeArchived=true', []),
    safeGet<DetteRow[]>('/api/dettes', []),
    safeGet<Record<string, unknown>[]>(`/api/payments?from=${first}&to=${last}`, []),
  ]);

  // Fixed-charge payments dated within this month — fetch per def.
  const fixesPaiements = (await Promise.all(
    allDefs.map((d) => safeGet<ChargeFixePaiement[]>(`/api/charges/fixes/${d.id}/paiements`, [])),
  )).flat();

  // Debt payments dated within this month — fetch per dette.
  const dettesPaiements = (await Promise.all(
    (allDettes ?? []).map((d) => safeGet<DettePaiement[]>(`/api/dettes/${d.id}/paiements`, [])),
  )).flat();

  const autresAmt   = autres.reduce((s, r) => s + Number(r.montant || 0), 0);
  const salairesAmt = salaires.filter((s) => s.salaire_paye).reduce((s, sm) => s + Number(sm.snap_net_a_payer ?? sm.montant_paye ?? 0), 0);
  const fixesAmt    = fixesPaiements
    .filter((p) => (p.datePaiement ?? '').slice(0, 10) >= first && (p.datePaiement ?? '').slice(0, 10) <= last)
    .reduce((s, p) => s + Number(p.montant || 0), 0);
  const varsAmt     = vars.reduce((s, v) => s + Number(v.montant || 0), 0);
  const dettesAmt   = dettesPaiements
    .filter((p) => p.date >= first && p.date <= last)
    .reduce((s, p) => s + Number(p.montant || 0), 0);

  // Factures encaissées ce mois : payées → TTC, partielles → montant payé.
  const facturesAmt = (paymentsRaw ?? []).reduce((s, p) => {
    const status = String(p.status ?? '');
    const ttc  = Number(p.totalTtc   ?? p.total_ttc   ?? 0);
    const paid = Number(p.amountPaid ?? p.amount_paid ?? 0);
    if (status === 'paid')    return s + ttc;
    if (status === 'partial') return s + paid;
    return s;
  }, 0);

  return {
    encaissements: facturesAmt + autresAmt,
    decaissements: salairesAmt + fixesAmt + varsAmt + dettesAmt,
    breakdown: {
      factures:         facturesAmt,
      autresRevenus:    autresAmt,
      salaires:         salairesAmt,
      chargesFixes:     fixesAmt,
      chargesVariables: varsAmt,
      dettes:           dettesAmt,
    },
  };
}

async function fetchReminders(ym: string): Promise<Reminder[]> {
  const today = new Date().toISOString().split('T')[0];
  const soon  = new Date(Date.now() + 7 * 86_400_000).toISOString().split('T')[0];
  const { last } = monthRange(ym);

  function urgencyFor(due?: string | null): 'overdue' | 'soon' | 'upcoming' {
    if (!due) return 'upcoming';
    return due < today ? 'overdue' : due <= soon ? 'soon' : 'upcoming';
  }

  const [dettesAll, employees, salairesMois, cfDefs] = await Promise.all([
    safeGet<DetteRow[]>('/api/dettes', []),
    safeGet<Employee[]>('/api/employees', []),
    safeGet<SalaireMensuel[]>(`/api/payroll/salaires?mois=${ym}`, []),
    safeGet<ChargeFixeDef[]>('/api/charges/fixes', []),
  ]);

  const reminders: Reminder[] = [];

  // À payer — salaires non versés
  const salaireMap = new Map<string, SalaireMensuel>(salairesMois.map((s) => [s.employee_id, s]));
  for (const emp of employees) {
    if (emp.archivedAt) continue;
    const row = salaireMap.get(emp.id);
    if (row?.salaire_paye) continue;
    const amount = Number(row?.snap_net_a_payer ?? 0);
    if (amount <= 0) continue;
    reminders.push({
      id:        `salary-${emp.id}-${ym}`,
      label:     `Salaire — ${emp.prenom} ${emp.nom}`,
      amount,
      dueDate:   last,
      type:      'salary',
      urgency:   urgencyFor(last),
      direction: 'out',
      href:      `${ROUTES.app.decaissements.salaires}?mois=${ym}`,
    });
  }

  // À payer — charges fixes non payées ce mois
  const paidChargeIds = new Set<string>();
  await Promise.all(cfDefs.map(async (d) => {
    const pays = await safeGet<ChargeFixePaiement[]>(`/api/charges/fixes/${d.id}/paiements`, []);
    if (pays.some((p) => p.mois === ym)) paidChargeIds.add(d.id);
  }));
  for (const def of cfDefs) {
    if (paidChargeIds.has(def.id)) continue;
    const dueDate = def.jourEcheance
      ? `${ym}-${String(def.jourEcheance).padStart(2, '0')}`
      : undefined;
    reminders.push({
      id:        `charge-${def.id}-${ym}`,
      label:     def.label,
      amount:    Number(def.montant || 0),
      dueDate,
      type:      'charge',
      urgency:   urgencyFor(dueDate),
      direction: 'out',
      href:      `${ROUTES.app.decaissements.chargesFixes}?id=${def.id}`,
    });
  }

  // À payer — dettes en cours
  for (const debt of dettesAll) {
    if (debt.archivedAt) continue;
    const remaining = Number(debt.montantTotal || 0) - Number(debt.montantPaye || 0);
    if (remaining <= 0) continue;
    reminders.push({
      id:        debt.id,
      label:     debt.creancier,
      amount:    remaining,
      dueDate:   debt.dateEcheance ?? undefined,
      type:      'debt',
      urgency:   urgencyFor(debt.dateEcheance),
      direction: 'out',
      href:      `${ROUTES.app.decaissements.dettes}?id=${debt.id}`,
    });
  }

  const order = { overdue: 0, soon: 1, upcoming: 2 } as const;
  reminders.sort((a, b) => order[a.urgency] - order[b.urgency]);
  return reminders;
}

async function fetchMovements(ym: string): Promise<Movement[]> {
  const { first, last } = monthRange(ym);

  const [autres, vars, salaires, employees, allDefs, allDettes] = await Promise.all([
    safeGet<AutreRevenu[]>(`/api/autres-revenus?from=${first}&to=${last}`, []),
    safeGet<ChargeVariable[]>(`/api/charges/variables?mois=${ym}`, []),
    safeGet<SalaireMensuel[]>(`/api/payroll/salaires?mois=${ym}`, []),
    safeGet<Employee[]>('/api/employees', []),
    safeGet<ChargeFixeDef[]>('/api/charges/fixes?includeArchived=true', []),
    safeGet<DetteRow[]>('/api/dettes', []),
  ]);

  const fixesPaiements = (await Promise.all(
    allDefs.map((d) => safeGet<ChargeFixePaiement[]>(`/api/charges/fixes/${d.id}/paiements`, [])),
  )).flat();
  const dettesPaiements = (await Promise.all(
    allDettes.map((d) => safeGet<DettePaiement[]>(`/api/dettes/${d.id}/paiements`, [])),
  )).flat();

  const movements: Movement[] = [];

  for (const r of autres) {
    movements.push({
      id:        `revenu-${r.id}`,
      date:      r.date,
      type:      'autre-revenu',
      label:     r.label || r.description || 'Autre revenu',
      amount:    Number(r.montant || 0),
      direction: 'in',
      href:      `${ROUTES.app.encaissements.autresRevenus}?id=${r.id}`,
    });
  }

  const empMap = new Map<string, Employee>(employees.map((e) => [e.id, e]));
  for (const s of salaires) {
    if (!s.salaire_paye) continue;
    const payDate = (s.date_paiement ?? `${ym}-01`).slice(0, 10);
    if (payDate < first || payDate > last) continue;
    const emp = empMap.get(s.employee_id);
    movements.push({
      id:        `salaire-${s.employee_id}-${s.mois}`,
      date:      payDate,
      type:      'salaire',
      label:     emp ? `Salaire — ${emp.prenom} ${emp.nom}` : 'Salaire',
      amount:    Number(s.snap_net_a_payer ?? s.montant_paye ?? 0),
      direction: 'out',
      dueDate:   s.mois,
      href:      `${ROUTES.app.decaissements.salaires}?mois=${s.mois}`,
    });
  }

  const cfMap = new Map<string, ChargeFixeDef>(allDefs.map((d) => [d.id, d]));
  for (const p of fixesPaiements) {
    const payDate = (p.datePaiement ?? `${ym}-01`).slice(0, 10);
    if (payDate < first || payDate > last) continue;
    const def     = cfMap.get(p.chargeId);
    const moisRef = p.mois ?? ym;
    const dueDay  = def?.jourEcheance;
    const dueDate = dueDay ? `${moisRef}-${String(dueDay).padStart(2, '0')}` : undefined;
    movements.push({
      id:        `cf-${p.id}`,
      date:      payDate,
      type:      'charge-fixe',
      label:     def?.label ?? 'Charge fixe',
      amount:    Number(p.montant || 0),
      direction: 'out',
      dueDate,
      href:      `${ROUTES.app.decaissements.chargesFixes}?id=${p.chargeId}`,
    });
  }

  for (const v of vars) {
    movements.push({
      id:        `cv-${v.id}`,
      date:      v.date,
      type:      'charge-variable',
      label:     v.label || 'Charge variable',
      amount:    Number(v.montant || 0),
      direction: 'out',
      href:      `${ROUTES.app.decaissements.chargesVariables}?id=${v.id}`,
    });
  }

  const dettesMap = new Map<string, DetteRow>(allDettes.map((d) => [d.id, d]));
  for (const p of dettesPaiements) {
    if (p.date < first || p.date > last) continue;
    const dette = dettesMap.get(p.detteId);
    movements.push({
      id:        `dette-${p.id}`,
      date:      p.date,
      type:      'dette',
      label:     dette?.creancier ?? 'Remboursement dette',
      amount:    Number(p.montant || 0),
      direction: 'out',
      dueDate:   dette?.dateEcheance ?? undefined,
      href:      `${ROUTES.app.decaissements.dettes}?id=${p.detteId}`,
    });
  }

  movements.sort((a, b) => (b.date !== a.date ? b.date.localeCompare(a.date) : b.amount - a.amount));
  return movements;
}

// ── Donut segment ─────────────────────────────────────────────────────────────

function DonutChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const R = 40, CIRC = 2 * Math.PI * R;

  return (
    <div className="ov-donut-wrap">
      <svg viewBox="0 0 100 100" className="ov-donut-svg">
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--border)" strokeWidth="16" />
        {slices.filter((s) => s.value > 0).map((s, i) => {
          const pct  = s.value / total;
          const dash = pct * CIRC;
          const seg = (
            <circle
              key={i}
              cx="50" cy="50" r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={-(offset * CIRC)}
              style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px' }}
            />
          );
          offset += pct;
          return seg;
        })}
        <text x="50" y="54" textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">
          {slices.length}
        </text>
      </svg>
      <div className="ov-donut-legend">
        {slices.map((s, i) => (
          <div key={i} className="ov-legend-row">
            <span className="ov-legend-dot" style={{ background: s.color }} />
            <span className="ov-legend-label">{s.label}</span>
            <span className="ov-legend-val">{fmtCurrency(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reminder item ─────────────────────────────────────────────────────────────

const URGENCY_LABELS = { overdue: 'En retard', soon: 'Bientôt', upcoming: 'À venir' } as const;

const TYPE_ICON: Record<Reminder['type'], React.ReactElement> = {
  invoice: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  salary:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  charge:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>,
  debt:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="12" cy="15" r="1" fill="currentColor"/></svg>,
};

function ReminderItem({ r }: { r: Reminder }) {
  return (
    <Link to={r.href} className={`ov-reminder-item ov-reminder-item--${r.urgency}`}>
      <div className={`ov-reminder-badge ov-reminder-badge--${r.urgency}`}>
        {TYPE_ICON[r.type]}
      </div>
      <div className="ov-reminder-info">
        <span className="ov-reminder-label">{r.label}</span>
        <span className="ov-reminder-meta">
          {URGENCY_LABELS[r.urgency]}
          {r.dueDate && ` · ${new Date(r.dueDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
        </span>
      </div>
      <span className="ov-reminder-amount">{fmtCurrency(r.amount)} TND</span>
    </Link>
  );
}

// ── Movement history ──────────────────────────────────────────────────────────

const MOVE_META: Record<MovementType, { label: string; color: string; bg: string }> = {
  'facture':          { label: 'Facture',      color: '#2563eb', bg: '#eff6ff' },
  'autre-revenu':     { label: 'Revenu',        color: '#7c3aed', bg: '#f5f3ff' },
  'salaire':          { label: 'Salaire',       color: '#ea580c', bg: '#fff7ed' },
  'charge-fixe':      { label: 'Charge fixe',   color: '#dc2626', bg: '#fff1f2' },
  'charge-variable':  { label: 'Charge var.',   color: '#db2777', bg: '#fdf2f8' },
  'dette':            { label: 'Dette',         color: '#4f46e5', bg: '#eef2ff' },
};

function fmtDueDate(raw: string): string {
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const [y, mo] = raw.split('-').map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  }
  return new Date(raw + (raw.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function MovementRow({ m }: { m: Movement }) {
  const meta = MOVE_META[m.type];
  return (
    <Link to={m.href} className="ov-mv-row">
      <div className={`ov-mv-dir ov-mv-dir--${m.direction}`}>
        {m.direction === 'in'
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
        }
      </div>
      <span className="ov-mv-badge" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
      <div className="ov-mv-info">
        <span className="ov-mv-label">{m.label}</span>
        {m.dueDate && (
          <span className="ov-mv-due">Échéance · {fmtDueDate(m.dueDate)}</span>
        )}
      </div>
      <div className="ov-mv-right">
        <span className={`ov-mv-amount ov-mv-amount--${m.direction}`}>
          {m.direction === 'in' ? '+' : '−'}{fmtCurrency(m.amount)} TND
        </span>
        <svg className="ov-mv-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </Link>
  );
}

type DirectionFilter = 'all' | 'in' | 'out';

function MovementHistoryContent({ movements }: { movements: Movement[] }) {
  const [direction,    setDirection]    = useState<DirectionFilter>('all');
  const [payDateFrom,  setPayDateFrom]  = useState('');
  const [payDateTo,    setPayDateTo]    = useState('');
  const [dueDateFrom,  setDueDateFrom]  = useState('');
  const [dueDateTo,    setDueDateTo]    = useState('');

  const hasActiveFilter = direction !== 'all' || payDateFrom || payDateTo || dueDateFrom || dueDateTo;

  function clearFilters() {
    setDirection('all');
    setPayDateFrom('');
    setPayDateTo('');
    setDueDateFrom('');
    setDueDateTo('');
  }

  const filtered = movements.filter((m) => {
    if (direction !== 'all' && m.direction !== direction) return false;
    if (payDateFrom && m.date < payDateFrom) return false;
    if (payDateTo   && m.date > payDateTo)   return false;
    if (dueDateFrom || dueDateTo) {
      if (!m.dueDate) return false;
      const due = m.dueDate.length === 7 ? m.dueDate + '-01' : m.dueDate;
      if (dueDateFrom && due < dueDateFrom) return false;
      if (dueDateTo   && due > dueDateTo)   return false;
    }
    return true;
  });

  const grouped = filtered.reduce<Record<string, Movement[]>>((acc, m) => {
    (acc[m.date] ??= []).push(m);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalIn  = filtered.filter((m) => m.direction === 'in').reduce((s, m) => s + m.amount, 0);
  const totalOut = filtered.filter((m) => m.direction === 'out').reduce((s, m) => s + m.amount, 0);

  return (
    <>
      <div className="ov-hist-hdr">
        <div className="ov-hist-hdr-left">
          <span className="ov-hist-title">Historique des mouvements</span>
          <span className="ov-mv-sum-count">{filtered.length} opération{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="ov-hist-hdr-right">
          <span className="ov-mv-sum-in">+{fmtCurrency(totalIn)}</span>
          <span className="ov-mv-sum-sep">·</span>
          <span className="ov-mv-sum-out">−{fmtCurrency(totalOut)}</span>
        </div>
      </div>

      <div className="ov-mv-filters">
        <div className="ov-mv-pills">
          <button
            className={`ov-mv-pill${direction === 'all' ? ' ov-mv-pill--active ov-mv-pill--all' : ''}`}
            onClick={() => setDirection('all')}
          >Tous</button>
          <button
            className={`ov-mv-pill${direction === 'in' ? ' ov-mv-pill--active ov-mv-pill--in' : ''}`}
            onClick={() => setDirection('in')}
          >Encaissements</button>
          <button
            className={`ov-mv-pill${direction === 'out' ? ' ov-mv-pill--active ov-mv-pill--out' : ''}`}
            onClick={() => setDirection('out')}
          >Décaissements</button>
        </div>

        <div className="ov-mv-date-filters">
          <div className="ov-mv-date-group">
            <label className="ov-mv-filter-label">Date de paiement</label>
            <div className="ov-mv-date-range">
              <DatePicker value={payDateFrom || null} onChange={setPayDateFrom} placeholder="Du" className="ov-mv-date-input" />
              <span className="ov-mv-date-sep">—</span>
              <DatePicker value={payDateTo || null} onChange={setPayDateTo} placeholder="Au" className="ov-mv-date-input" />
            </div>
          </div>
          <div className="ov-mv-date-group">
            <label className="ov-mv-filter-label">Date d'échéance</label>
            <div className="ov-mv-date-range">
              <DatePicker value={dueDateFrom || null} onChange={setDueDateFrom} placeholder="Du" className="ov-mv-date-input" />
              <span className="ov-mv-date-sep">—</span>
              <DatePicker value={dueDateTo || null} onChange={setDueDateTo} placeholder="Au" className="ov-mv-date-input" />
            </div>
          </div>
          {hasActiveFilter && (
            <button className="ov-mv-clear-btn" onClick={clearFilters}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <div className="ov-hist-body">
        {filtered.length === 0 ? (
          <div className="ov-empty-chart">Aucun mouvement pour ces critères</div>
        ) : (
          <div className="ov-mv-list">
            {dates.map((date) => (
              <div key={date} className="ov-mv-group">
                <div className="ov-mv-date-header">
                  {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}
                </div>
                {grouped[date].map((m) => <MovementRow key={m.id} m={m} />)}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { user } = useAuth();

  const [month,        setMonth]        = useState(currentYM());
  const [data,         setData]         = useState<MonthData | null>(null);
  const [priorBalance, setPriorBalance] = useState(0);
  const [reminders,    setReminders]    = useState<Reminder[]>([]);
  const [movements,    setMovements]    = useState<Movement[]>([]);
  const [summary,      setSummary]      = useState<SummaryData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [showHistory,  setShowHistory]  = useState(false);

  const load = useCallback(async (ym: string) => {
    setLoading(true);
    try {
      const [current, prior, remindersData, movementsData, summaryData] = await Promise.all([
        fetchMonthData(ym),
        fetchPriorBalance(ym),
        fetchReminders(ym),
        fetchMovements(ym),
        fetchSummaryData(),
      ]);
      setData(current);
      setPriorBalance(prior);
      setReminders(remindersData);
      setMovements(movementsData);
      setSummary(summaryData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (user) load(month); }, [user, month, load]);

  const monthNet   = data ? data.encaissements - data.decaissements : 0;
  const balance    = priorBalance + monthNet;
  const isPositive = balance >= 0;

  const incomeSlices = data ? [
    { label: 'Factures',      value: data.breakdown.factures,      color: '#3b82f6' },
    { label: 'Autres revenus',value: data.breakdown.autresRevenus, color: '#8b5cf6' },
  ].filter((s) => s.value > 0) : [];

  const expenseSlices = data ? [
    { label: 'Salaires',          value: data.breakdown.salaires,         color: '#f97316' },
    { label: 'Charges fixes',     value: data.breakdown.chargesFixes,     color: '#ef4444' },
    { label: 'Charges variables', value: data.breakdown.chargesVariables, color: '#ec4899' },
    { label: 'Dettes',            value: data.breakdown.dettes,           color: '#6366f1' },
  ].filter((s) => s.value > 0) : [];

  const overdueCount = reminders.filter((r) => r.urgency === 'overdue').length;
  const soonCount    = reminders.filter((r) => r.urgency === 'soon').length;

  return (
    <div className="ov-page">

      <div className="ov-page-header">
        <div>
          <h1 className="ov-page-title">Aperçu financier</h1>
          <p className="ov-page-sub">Vue d'ensemble de votre situation financière</p>
        </div>
        <div className="ov-header-right">
          {!loading && (
            <motion.button
              className="btn-pill"
              onClick={() => setShowHistory(true)}
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.03 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/>
                <rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
              </svg>
              Historique
            </motion.button>
          )}
          <div className="ov-month-nav">
            <button className="ov-month-btn" onClick={() => setMonth(prevMonth(month))}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button
              className={`ov-month-label${month !== currentYM() ? ' ov-month-label--clickable' : ''}`}
              onClick={() => setMonth(currentYM())}
              title={month !== currentYM() ? 'Revenir au mois actuel' : undefined}
            >
              {fmtMonth(month)}
            </button>
            <button
              className="ov-month-btn"
              onClick={() => setMonth(nextMonth(month))}
              disabled={month >= currentYM()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="ov-loading">
          <div className="ov-spinner" />
          <span>Chargement…</span>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {showHistory ? (
            <motion.div
              key="history"
              className="ov-hist-wrap"
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <GlowCard borderRadius={60}>
                <div className="ov-hist-panel">
                  <button
                    type="button"
                    className="ov-hist-close"
                    aria-label="Fermer"
                    onClick={() => setShowHistory(false)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                  <MovementHistoryContent movements={movements} />
                </div>
              </GlowCard>
            </motion.div>
          ) : (
            <motion.div
              key="main"
              className="ov-main-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Hero balance + KPIs */}
              <div className="ov-kpi-row">

                <motion.div
                  className={`ov-balance-card${isPositive ? ' ov-balance-card--pos' : ' ov-balance-card--neg'}`}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                >
                  <div className="ov-balance-label">Solde cumulé</div>
                  <div className={`ov-balance-amount${isPositive ? ' ov-balance-amount--pos' : ' ov-balance-amount--neg'}`}>
                    {isPositive ? '+' : ''}{fmtCurrency(balance)} TND
                  </div>
                  <div className="ov-balance-bar">
                    <div
                      className="ov-balance-bar-enc"
                      style={{ width: data ? `${(data.encaissements / (data.encaissements + data.decaissements || 1)) * 100}%` : '50%' }}
                    />
                  </div>
                  <div className="ov-balance-bar-labels">
                    <span className="ov-balance-bar-labels--enc">Encaissé ce mois</span>
                    <span className="ov-balance-bar-labels--dec">Décaissé ce mois</span>
                  </div>
                  <div className="ov-balance-prior">
                    <span className="ov-balance-prior-label">Report mois précédent</span>
                    <span className={`ov-balance-prior-val${priorBalance >= 0 ? ' ov-balance-prior-val--pos' : ' ov-balance-prior-val--neg'}`}>
                      {priorBalance >= 0 ? '+' : ''}{fmtCurrency(priorBalance)}
                    </span>
                  </div>
                  <div className="ov-balance-prior">
                    <span className="ov-balance-prior-label">Ce mois</span>
                    <span className={`ov-balance-prior-val${monthNet >= 0 ? ' ov-balance-prior-val--pos' : ' ov-balance-prior-val--neg'}`}>
                      {monthNet >= 0 ? '+' : ''}{fmtCurrency(monthNet)}
                    </span>
                  </div>
                </motion.div>

                <motion.div
                  className="ov-kpi-card"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
                >
                  <div className="ov-kpi-icon ov-kpi-icon--green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                  </div>
                  <div className="ov-kpi-label">Encaissements</div>
                  <div className="ov-kpi-value ov-kpi-value--green">{fmtCurrency(data?.encaissements ?? 0)}</div>
                  <div className="ov-kpi-sub">TND</div>
                  <div className="ov-kpi-breakdown">
                    <span>Factures: {fmtCurrency(data?.breakdown.factures ?? 0)}</span>
                    <span>Autres: {fmtCurrency(data?.breakdown.autresRevenus ?? 0)}</span>
                  </div>
                </motion.div>

                <motion.div
                  className="ov-kpi-card"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <div className="ov-kpi-icon ov-kpi-icon--red">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                  </div>
                  <div className="ov-kpi-label">Décaissements</div>
                  <div className="ov-kpi-value ov-kpi-value--red">{fmtCurrency(data?.decaissements ?? 0)}</div>
                  <div className="ov-kpi-sub">TND</div>
                  <div className="ov-kpi-breakdown">
                    <span>Salaires: {fmtCurrency(data?.breakdown.salaires ?? 0)}</span>
                    <span>Charges: {fmtCurrency((data?.breakdown.chargesFixes ?? 0) + (data?.breakdown.chargesVariables ?? 0))}</span>
                  </div>
                </motion.div>

                <motion.div
                  className="ov-kpi-card"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}
                >
                  <div className="ov-kpi-icon ov-kpi-icon--orange">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                  </div>
                  <div className="ov-kpi-label">Rappels</div>
                  <div className="ov-kpi-value ov-kpi-value--orange">{reminders.length}</div>
                  <div className="ov-kpi-sub">en attente</div>
                  <div className="ov-kpi-breakdown">
                    {overdueCount > 0 && <span className="ov-kpi-breakdown--alert">{overdueCount} en retard</span>}
                    {soonCount    > 0 && <span className="ov-kpi-breakdown--warn">{soonCount} bientôt</span>}
                    {overdueCount === 0 && soonCount === 0 && <span>Tout est à jour</span>}
                  </div>
                </motion.div>
              </div>

              {/* Financial situation */}
              {summary && (
                <div className="ov-situation-row">

                  <motion.div
                    className="ov-sit-card"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.18 }}
                  >
                    <div className="ov-sit-hdr">
                      <div className="ov-sit-icon ov-sit-icon--orange">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </div>
                      <div>
                        <div className="ov-sit-title">Charges reportées</div>
                        <div className="ov-sit-sub">Mois impayés cumulés</div>
                      </div>
                    </div>
                    {summary.chargesReportees.length === 0 ? (
                      <div className="ov-sit-ok">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Toutes les charges sont à jour
                      </div>
                    ) : (
                      <div className="ov-sit-charge-list">
                        {summary.chargesReportees.map((item) => (
                          <Link key={item.defId} to={item.href} className="ov-sit-charge-item">
                            <div className="ov-sit-charge-info">
                              <span className="ov-sit-charge-label">{item.label}</span>
                              <span className="ov-sit-charge-late">{item.monthsLate} mois en retard</span>
                            </div>
                            <div className="ov-sit-charge-right">
                              <span className="ov-sit-charge-amount">{fmtCurrency(item.totalDue)} TND</span>
                              <svg className="ov-sit-charge-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  <motion.div
                    className="ov-sit-card"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.22 }}
                  >
                    <div className="ov-sit-hdr">
                      <div className="ov-sit-icon ov-sit-icon--blue">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                      </div>
                      <div>
                        <div className="ov-sit-title">CNSS — {summary.cnss.qLabel}</div>
                        <div className="ov-sit-sub">{summary.cnss.qMonthsLabel}</div>
                      </div>
                    </div>

                    <div className={`ov-cnss-status${summary.cnss.isPaid ? ' ov-cnss-status--paid' : summary.cnss.isOverdue ? ' ov-cnss-status--overdue' : ' ov-cnss-status--ok'}`}>
                      {summary.cnss.isPaid ? (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 14, height: 14, flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                          <div>
                            <div className="ov-cnss-status-main">Payé — {fmtCurrency(summary.cnss.paidAmount)} TND</div>
                            {summary.cnss.paidDate && (
                              <div className="ov-cnss-status-sub">
                                Le {new Date(summary.cnss.paidDate).toLocaleDateString('fr-FR')}
                                {summary.cnss.penalty > 0 && ` · pénalité ${fmtCurrency(summary.cnss.penalty)} TND`}
                              </div>
                            )}
                          </div>
                        </>
                      ) : summary.cnss.isOverdue ? (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          <div>
                            <div className="ov-cnss-status-main">{summary.cnss.monthsLate} mois de retard</div>
                            <div className="ov-cnss-status-sub">Échéance : {summary.cnss.deadlineLabel}</div>
                          </div>
                        </>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 14, height: 14, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <div>
                            <div className="ov-cnss-status-main">
                              {summary.cnss.daysLeft > 0 ? `${summary.cnss.daysLeft} jour${summary.cnss.daysLeft > 1 ? 's' : ''} restant${summary.cnss.daysLeft > 1 ? 's' : ''}` : "Échéance aujourd'hui"}
                            </div>
                            <div className="ov-cnss-status-sub">Aucune pénalité de retard</div>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="ov-sit-rows">
                      <div className="ov-sit-row">
                        <span className="ov-sit-row-label">Part salarié</span>
                        <span className="ov-sit-row-val" style={{ color: '#2563eb' }}>{fmtCurrency(summary.cnss.totalSalarie)} TND</span>
                      </div>
                      <div className="ov-sit-row ov-sit-row--sep">
                        <span className="ov-sit-row-label">Part employeur</span>
                        <span className="ov-sit-row-val" style={{ color: '#7c3aed' }}>{fmtCurrency(summary.cnss.totalEmployeur)} TND</span>
                      </div>
                      <div className="ov-sit-row ov-sit-row--sep">
                        <span className="ov-sit-row-label" style={{ fontWeight: 700 }}>Total {summary.cnss.qLabel}</span>
                        <span className="ov-sit-row-val" style={{ color: '#dc2626', fontWeight: 700 }}>{fmtCurrency(summary.cnss.totalBrut)} TND</span>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    className="ov-sit-card"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.26 }}
                  >
                    <div className="ov-sit-hdr">
                      <div className="ov-sit-icon ov-sit-icon--purple">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                          <rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><circle cx="12" cy="15" r="1" fill="currentColor"/>
                        </svg>
                      </div>
                      <div>
                        <div className="ov-sit-title">Dettes</div>
                        <div className="ov-sit-sub">Total des engagements</div>
                      </div>
                    </div>
                    <div className="ov-sit-rows">
                      <div className="ov-sit-row">
                        <span className="ov-sit-row-label">Total emprunté</span>
                        <span className="ov-sit-row-val">{fmtCurrency(summary.dettes.total)} TND</span>
                      </div>
                      <div className="ov-sit-row">
                        <span className="ov-sit-row-label">Remboursé</span>
                        <span className="ov-sit-row-val ov-sit-row-val--pos">{fmtCurrency(summary.dettes.paye)} TND</span>
                      </div>
                      <div className="ov-sit-row ov-sit-row--sep">
                        <span className="ov-sit-row-label">Restant dû</span>
                        <span className={`ov-sit-row-val${summary.dettes.restant > 0 ? ' ov-sit-row-val--neg' : ' ov-sit-row-val--pos'}`}>
                          {fmtCurrency(summary.dettes.restant)} TND
                        </span>
                      </div>
                    </div>
                    {summary.dettes.total > 0 && (
                      <div className="ov-sit-progress-wrap">
                        <div className="ov-sit-progress-bar">
                          <div
                            className="ov-sit-progress-fill"
                            style={{ width: `${Math.min(100, (summary.dettes.paye / summary.dettes.total) * 100)}%` }}
                          />
                        </div>
                        <span className="ov-sit-progress-pct">
                          {Math.round((summary.dettes.paye / summary.dettes.total) * 100)}% remboursé
                        </span>
                      </div>
                    )}
                  </motion.div>

                </div>
              )}

              {/* Reminders */}
              {(() => {
                const inR     = reminders.filter((r) => r.direction === 'in');
                const outR    = reminders.filter((r) => r.direction === 'out');
                const inTotal  = inR.reduce((s, r) => s + (r.amount ?? 0), 0);
                const outTotal = outR.reduce((s, r) => s + (r.amount ?? 0), 0);
                return (
                  <motion.div
                    className="ov-panel ov-panel--reminders"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <div className="ov-panel-header">
                      <span className="ov-panel-title">Rappels</span>
                      {overdueCount > 0 && <span className="ov-badge-overdue">{overdueCount} en retard</span>}
                    </div>
                    <div className="ov-reminders-split">

                      <div className="ov-reminders-col">
                        <div className="ov-reminders-col-hdr ov-reminders-col-hdr--in">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                          À encaisser
                          <span className="ov-rc-count ov-rc-count--in">{inR.length}</span>
                          {inTotal > 0 && <span className="ov-rc-total ov-rc-total--in">{fmtCurrency(inTotal)} TND</span>}
                        </div>
                        {inR.length === 0 ? (
                          <div className="ov-empty-reminders">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <p>Toutes les factures sont réglées</p>
                          </div>
                        ) : (
                          <div className="ov-reminders-list">
                            {inR.map((r) => <ReminderItem key={r.id} r={r} />)}
                          </div>
                        )}
                      </div>

                      <div className="ov-reminders-divider" />

                      <div className="ov-reminders-col">
                        <div className="ov-reminders-col-hdr ov-reminders-col-hdr--out">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
                          À payer
                          <span className="ov-rc-count ov-rc-count--out">{outR.length}</span>
                          {outTotal > 0 && <span className="ov-rc-total ov-rc-total--out">{fmtCurrency(outTotal)} TND</span>}
                        </div>
                        {outR.length === 0 ? (
                          <div className="ov-empty-reminders">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <p>Toutes les charges sont payées</p>
                          </div>
                        ) : (
                          <div className="ov-reminders-list">
                            {outR.map((r) => <ReminderItem key={r.id} r={r} />)}
                          </div>
                        )}
                      </div>

                    </div>
                  </motion.div>
                );
              })()}

              {/* Donuts */}
              <div className="ov-row3">
                <motion.div
                  className="ov-panel"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.3 }}
                >
                  <div className="ov-panel-header">
                    <span className="ov-panel-title">Répartition des revenus</span>
                  </div>
                  {incomeSlices.length === 0
                    ? <div className="ov-empty-chart">Aucun revenu ce mois</div>
                    : <DonutChart slices={incomeSlices} />
                  }
                </motion.div>

                <motion.div
                  className="ov-panel"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.35 }}
                >
                  <div className="ov-panel-header">
                    <span className="ov-panel-title">Répartition des dépenses</span>
                  </div>
                  {expenseSlices.length === 0
                    ? <div className="ov-empty-chart">Aucune dépense ce mois</div>
                    : <DonutChart slices={expenseSlices} />
                  }
                </motion.div>

                <motion.div
                  className="ov-panel"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.4 }}
                >
                  <div className="ov-panel-header">
                    <span className="ov-panel-title">Détail des dépenses</span>
                  </div>
                  <div className="ov-expense-rows">
                    {[
                      { label: 'Salaires',          val: data?.breakdown.salaires ?? 0,         color: '#f97316', icon: '👥' },
                      { label: 'Charges fixes',     val: data?.breakdown.chargesFixes ?? 0,     color: '#ef4444', icon: '🔒' },
                      { label: 'Charges variables', val: data?.breakdown.chargesVariables ?? 0, color: '#ec4899', icon: '📦' },
                      { label: 'Dettes',            val: data?.breakdown.dettes ?? 0,           color: '#6366f1', icon: '🏦' },
                    ].map((row) => {
                      const pct = data?.decaissements ? (row.val / data.decaissements) * 100 : 0;
                      return (
                        <div key={row.label} className="ov-expense-row">
                          <span className="ov-expense-icon">{row.icon}</span>
                          <div className="ov-expense-info">
                            <div className="ov-expense-name">{row.label}</div>
                            <div className="ov-expense-bar-wrap">
                              <div className="ov-expense-bar-fill" style={{ width: `${pct}%`, background: row.color }} />
                            </div>
                          </div>
                          <span className="ov-expense-val">{fmtCurrency(row.val)}</span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}
