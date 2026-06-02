import { useMemo, useCallback } from 'react';
import type { Employee, FichesPaie, EmployeeMensuel, SalaryElement } from '../types';
import { usePayrollRates, DEFAULT_RATES } from './usePayrollRates';
import type { PayrollRates, IrppBracket } from './usePayrollRates';
import { useIrppBaremesDb } from './useIrppBaremesDb';
import type { EmployeePayrollSettings } from './useEmployeePayrollSettingsDb';
import { useEmployeesDb } from './useEmployeesDb';
import { useEmployeeMensuel } from './useEmployeeMensuel';
import type { FicheSnapshot } from './useEmployeeMensuel';
import { useContractHistory } from './useContractHistory';
import { useSalaryPartials } from './useSalaryPartials';

/* ── IRPP Tunisie — barème annuel progressif ── */
function irppAnnuel(imposableAnnuel: number, brackets: IrppBracket[]): number {
  let impot = 0;
  let reste = imposableAnnuel;
  let prev = 0;
  for (const { plafond: _plafond, taux } of brackets) {
    const plafond = _plafond === null ? Infinity : _plafond;
    const tranche = Math.min(reste, plafond - prev);
    if (tranche <= 0) break;
    impot += tranche * taux;
    reste -= tranche;
    prev = plafond;
  }
  return impot;
}

// Contract types exempt from all payroll taxes
const EXEMPT_TYPES = new Set(['CIVP', 'Freelance', 'Stage']);

/**
 * Count Mon–Fri working days in the range [start, end] inclusive.
 * Both dates should be at midnight local time.
 */
function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(),   end.getMonth(),   end.getDate());
  while (d <= e) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++; // 0 = Sunday, 6 = Saturday
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** Total Mon–Fri days in the given YYYY-MM month (varies between 20 and 23). */
export function workingDaysInMonth(mois: string): number {
  const [y, m] = mois.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 0); // last calendar day
  return countWorkingDays(start, end);
}

/**
 * If date_debut falls within `mois` and is after the 1st, return the
 * number of working days the employee actually worked in that month.
 * Returns null when no pro-ration is needed (full month).
 */
export function firstMonthWorkedDays(emp: Employee, mois: string): number | null {
  if (!emp.date_debut) return null;

  const [y, m] = mois.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 0);           // last calendar day
  const debutDate  = new Date(emp.date_debut);
  debutDate.setHours(0, 0, 0, 0);

  // Pro-ration only applies in the very first month and only when the
  // employee didn't start on the 1st (starting on the 1st = full month).
  if (debutDate <= monthStart || debutDate > monthEnd) return null;

  return countWorkingDays(debutDate, monthEnd);
}

/**
 * Pro-ration for the final partial month: if archived_at falls within `mois`,
 * returns working days from month-start to the archive date.
 * Returns null when no pro-ration is needed.
 */
export function lastMonthWorkedDays(emp: Employee, mois: string): number | null {
  if (!emp.archived_at) return null;

  const [y, m] = mois.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 0);
  const archivedDate = new Date(emp.archived_at);
  archivedDate.setHours(0, 0, 0, 0);

  // Only pro-rate if the archive date is strictly inside this month
  if (archivedDate < monthStart || archivedDate >= monthEnd) return null;

  return countWorkingDays(monthStart, archivedDate);
}

/**
 * Pro-ration for the return month after reactivation: if date_retour falls within `mois`
 * and is after the 1st, returns working days from date_retour to month-end.
 * Returns null when no pro-ration is needed.
 */
export function returnMonthWorkedDays(emp: Employee, mois: string): number | null {
  if (!emp.date_retour) return null;

  const [y, m] = mois.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 0);
  const retourDate = new Date(emp.date_retour);
  retourDate.setHours(0, 0, 0, 0);

  // Pro-ration only in the return month when return is strictly after the 1st
  if (retourDate <= monthStart || retourDate > monthEnd) return null;

  return countWorkingDays(retourDate, monthEnd);
}

/**
 * Returns true if the employee should appear in a given month's payroll.
 *
 * Rules:
 *  - date_debut must be ≤ last day of the month   (contract started by month-end)
 *  - date_fin (CDD end) must be null OR ≥ first day of month
 *  - If archived: archived_at < monthStart means excluded, UNLESS date_retour ≤ monthEnd
 */
export function isEmployeeActiveInMonth(emp: Employee, mois: string): boolean {
  const [y, m] = mois.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd   = new Date(y, m, 0);

  // Must have started by the end of the month
  if (emp.date_debut) {
    const start = new Date(emp.date_debut);
    if (start > monthEnd) return false;
  }

  // Contract end date (CDD/CIVP/Stage) must not have passed before the month started
  if (emp.date_fin) {
    const end = new Date(emp.date_fin);
    if (end < monthStart) return false;
  }

  // Archiving and optional reactivation
  if (emp.archived_at) {
    const archived = new Date(emp.archived_at);
    if (archived < monthStart) {
      // Archived before this month — only active if reactivated by month-end
      if (!emp.date_retour) return false;
      const retour = new Date(emp.date_retour);
      return retour <= monthEnd;
    }
  }

  return true;
}

/**
 * Binary-search: find gross such that
 *   (gross − cnss_employee − solidarity − irpp) ≈ targetNet.
 * IRPP is progressive so this cannot be inverted analytically.
 */
export function brutFromNet(targetNet: number, rates: PayrollRates): number {
  if (targetNet <= 0) return 0;
  let low = targetNet;
  let high = targetNet * 3;

  for (let i = 0; i < 64; i++) {
    const mid                  = (low + high) / 2;
    const cnss                 = mid * rates.cnss_employee;
    const imposable            = mid - cnss;
    const abattement_rate      = rates.abattement ?? 0;
    const abattement_amt       = imposable * abattement_rate;
    const revenu_net_imposable = imposable - abattement_amt;
    // Contribution base: revenu net imposable when abattement is active, imposable otherwise
    const contribution_base    = abattement_rate > 0 ? revenu_net_imposable : imposable;
    const solidarity           = contribution_base * rates.solidarity_employee;
    const irpp                 = irppAnnuel(revenu_net_imposable * 12, rates.irpp_brackets) / 12;
    const calculatedNet        = mid - cnss - solidarity - irpp;

    if (Math.abs(calculatedNet - targetNet) < 0.0005) break;
    if (calculatedNet < targetNet) low = mid;
    else high = mid;
  }

  return +((low + high) / 2).toFixed(3);
}

/**
 * Apply the salary elements that match the given base flag to a starting brut.
 * - First pass: monetary (TND) gains/deductions
 * - Second pass: days-based, converted with `pre / workDays × days` using the
 *   actual Mon–Fri count for the month (no hardcoded 22).
 */
function applyAdjustments(
  baseBrut: number,
  elements: SalaryElement[] | undefined,
  flag: 'affects_brut' | 'affects_cnss' | 'affects_irpp',
  workDays: number,
): number {
  if (!elements?.length) return baseBrut;
  let v = baseBrut;
  for (const el of elements) {
    if (!el.enabled || !el[flag] || el.unit === 'days') continue;
    if (el.type === 'gain') v += el.amount;
    else if (el.type === 'deduction') v -= el.amount;
  }
  const ref = v;
  for (const el of elements) {
    if (!el.enabled || !el[flag] || el.unit !== 'days') continue;
    const retenue = ref / workDays * el.amount;
    if (el.type === 'gain') v += retenue;
    else if (el.type === 'deduction') v -= retenue;
  }
  return v;
}

function netOnlyTotal(elements: SalaryElement[] | undefined): number {
  if (!elements?.length) return 0;
  return elements
    .filter((e) => e.enabled && e.type === 'net_only')
    .reduce((s, e) => s + e.amount, 0);
}

export function calculerFichePaie(
  emp: Employee,
  mois: string,
  rates: PayrollRates = DEFAULT_RATES,
  mensuel?: EmployeeMensuel,
  empSettings?: EmployeePayrollSettings,
): FichesPaie {
  // Merge global rates with per-employee overrides (employee takes priority)
  const effectiveRates: PayrollRates = empSettings?.overrides
    ? { ...rates, ...empSettings.overrides }
    : rates;
  const salaryMode = empSettings?.salary_mode ?? 'net';

  const exempt = EXEMPT_TYPES.has(emp.type_contrat ?? '');

  // Actual Mon–Fri days in this month — used as divisor for all day-based calculations.
  const workDays = workingDaysInMonth(mois);

  // Pro-rate when the employee starts, leaves, or returns mid-month.
  // Same-month archive+reactivation: sum both partial periods (pre-archive + post-return).
  const _last   = lastMonthWorkedDays(emp, mois);
  const _return = returnMonthWorkedDays(emp, mois);
  const _first  = firstMonthWorkedDays(emp, mois);
  const workedDays = (_last !== null && _return !== null)
    ? _last + _return
    : _last ?? _return ?? _first;
  const salaire_saisi = workedDays !== null
    ? +(emp.salaire_base * workedDays / workDays).toFixed(3)
    : emp.salaire_base;

  const elements = mensuel?.salary_elements;
  const acompteTotal = netOnlyTotal(elements);

  const bonusEl   = elements?.find((e) => e.id === 'bonus');
  const absenceEl = elements?.find((e) => e.id === 'absence');
  const bonus = bonusEl && bonusEl.enabled ? bonusEl.amount : 0;

  if (exempt) {
    const salaire_brut    = salaire_saisi;
    const brut_effectif   = +applyAdjustments(salaire_brut, elements, 'affects_brut', workDays).toFixed(3);
    const deduction_absences = absenceEl && absenceEl.enabled
      ? +((salaire_brut + bonus) / workDays * absenceEl.amount).toFixed(3) : 0;
    const net         = brut_effectif;
    const net_a_payer = +(net - acompteTotal).toFixed(3);
    return {
      salaire_brut, bonus, deduction_absences, brut_effectif,
      cnss_salarie: 0, salaire_imposable: brut_effectif,
      abattement_amount: 0, revenu_net_imposable: brut_effectif,
      irpp_mensuel: 0, solidarity_salarie: 0,
      net, acompte: acompteTotal, net_a_payer,
      charges_employeur: 0, cout_total: brut_effectif,
      detail_employeur: { cnss: 0, tfp: 0, foprolos: 0, at: 0 },
    };
  }

  // CDI / CDD
  const salaire_brut = salaryMode === 'base'
    ? salaire_saisi
    : brutFromNet(salaire_saisi, effectiveRates);

  const brut_effectif  = +applyAdjustments(salaire_brut, elements, 'affects_brut', workDays).toFixed(3);
  const cnss_base      = +applyAdjustments(salaire_brut, elements, 'affects_cnss', workDays).toFixed(3);
  const irpp_pre_base  = +applyAdjustments(salaire_brut, elements, 'affects_irpp', workDays).toFixed(3);

  const deduction_absences = absenceEl && absenceEl.enabled
    ? +((salaire_brut + bonus) / workDays * absenceEl.amount).toFixed(3) : 0;

  // 1. CNSS — on cnss_base (elements can exempt some gains via affects_cnss)
  const cnss_salarie = +(cnss_base * effectiveRates.cnss_employee).toFixed(3);

  // 2. Salaire imposable = IRPP-adjusted brut − CNSS
  const salaire_imposable = +(irpp_pre_base - cnss_salarie).toFixed(3);

  // 3. Abattement on salaire imposable
  const abattement_rate      = effectiveRates.abattement ?? 0;
  const abattement_amount    = +(salaire_imposable * abattement_rate).toFixed(3);

  // 4. Revenu net imposable = salaire imposable − abattement
  const revenu_net_imposable = +(salaire_imposable - abattement_amount).toFixed(3);

  // 5. Contribution sociale — base switches on abattement
  //    abattement > 0  → base = revenu net imposable
  //    abattement = 0  → base = salaire imposable
  const contribution_base  = abattement_rate > 0 ? revenu_net_imposable : salaire_imposable;
  const solidarity_salarie = +(contribution_base * effectiveRates.solidarity_employee).toFixed(3);

  // 6. IRPP on revenu net imposable (before contribution)
  const irpp_mensuel = +(irppAnnuel(revenu_net_imposable * 12, effectiveRates.irpp_brackets) / 12).toFixed(3);

  // 7. Net = brut − CNSS − solidarity − IRPP
  const net         = +(brut_effectif - cnss_salarie - solidarity_salarie - irpp_mensuel).toFixed(3);
  const net_a_payer = +(net - acompteTotal).toFixed(3);

  const cnss_emp      = +(brut_effectif * effectiveRates.cnss_employer).toFixed(3);
  const tfp           = +(brut_effectif * effectiveRates.tfp).toFixed(3);
  const foprolos      = +(brut_effectif * effectiveRates.foprolos).toFixed(3);
  const at            = +(brut_effectif * effectiveRates.at).toFixed(3);
  const charges_employeur = +(cnss_emp + tfp + foprolos + at).toFixed(3);
  const cout_total    = +(brut_effectif + charges_employeur).toFixed(3);

  return {
    salaire_brut, bonus, deduction_absences, brut_effectif,
    cnss_salarie, salaire_imposable,
    abattement_amount, revenu_net_imposable,
    irpp_mensuel, solidarity_salarie,
    net,
    acompte: acompteTotal,
    net_a_payer,
    charges_employeur,
    cout_total,
    detail_employeur: { cnss: cnss_emp, tfp, foprolos, at },
  };
}

/** Enumerate YYYY-MM month keys from start to end, inclusive */
function enumerateMonths(startYM: string, endYM: string): string[] {
  if (startYM > endYM) return [];
  const result: string[] = [];
  let m = startYM;
  while (m <= endYM) {
    result.push(m);
    const [y, mm] = m.split('-').map(Number);
    const next = new Date(y, mm, 1);
    m = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
  }
  return result;
}

function moisLabelFr(mois: string): string {
  const [y, m] = mois.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Previous YYYY-MM relative to the given month */
function prevMois(mois: string): string {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface CarryoverEntry {
  /** YYYY-MM key for the unpaid month */
  moisKey: string;
  /** "Mars 2026" — display label */
  label: string;
  /** Computed fiche for that month using historical contract + saved adjustments */
  fiche: FichesPaie;
  /** Amount already paid via partial payments (0 if none) */
  montant_paye: number;
}

export function useSalaires(mois: string) {
  const { rates } = usePayrollRates();
  const { currentBareme, getBaremeForMois, saveBareme, loading: baremeLoading } = useIrppBaremesDb();
  const { employees, loading: empLoading, error, addEmployee, updateEmployee, archiveEmployee, restoreEmployee, removeEmployee } = useEmployeesDb();
  const {
    loading: mensuelLoading,
    getAdjustment, getAdjustmentForMois,
    setElements, setElementsForMois, resetAdjustment, hasAdjustment,
    marquerPaye: _marquerPaye, marquerPayeForMois: _marquerPayeForMois, marquerImpaye,
    setMontantPaye, recordAcompteForMois, getPaymentsInPaymentMois,
  } = useEmployeeMensuel(mois);
  const { loading: historyLoading, getContractForMonth, getPayrollSettingsForMonth, getEmployeeHistory, addContractChange } = useContractHistory();
  const { loading: partialsLoading, partials, addPartial, getPartials } = useSalaryPartials();

  /** Employees whose contract was active during the selected month */
  const activeEmployees = useMemo(
    () => employees.filter((e) => isEmployeeActiveInMonth(e, mois)),
    [employees, mois],
  );

  /** Employees currently archived (archived_at set, not yet reactivated) */
  const archivedEmployees = useMemo(
    () => employees.filter((e) => e.archived_at != null && e.date_retour == null),
    [employees],
  );

  /** Compute fiche for any (employee, mois) using historical contract + saved adjustments */
  const computeFicheForMois = useCallback(
    (emp: Employee, m: string): FichesPaie => {
      const contract = getContractForMonth(emp.id, m, { salaire_base: emp.salaire_base, type_contrat: emp.type_contrat });
      const empForCalc = (contract.salaire_base !== emp.salaire_base || contract.type_contrat !== emp.type_contrat)
        ? { ...emp, salaire_base: contract.salaire_base, type_contrat: contract.type_contrat as any }
        : emp;
      // Load per-employee settings effective in month m (temporal)
      const empSettings = getPayrollSettingsForMonth(emp.id, m);
      // Inject the global IRPP brackets effective in month m, unless employee has a custom override
      const irppBrackets = empSettings.overrides.irpp_brackets ?? getBaremeForMois(m);
      const mergedSettings: EmployeePayrollSettings = {
        ...empSettings,
        overrides: { ...empSettings.overrides, irpp_brackets: irppBrackets },
      };
      return calculerFichePaie(empForCalc, m, rates, getAdjustmentForMois(emp.id, m), mergedSettings);
    },
    [getContractForMonth, getAdjustmentForMois, rates, getPayrollSettingsForMonth, getBaremeForMois],
  );

  const fiches = useMemo(() => {
    const map = new Map<string, FichesPaie>();
    activeEmployees.forEach((e) => {
      map.set(e.id, computeFicheForMois(e, mois));
    });
    return map;
  }, [activeEmployees, mois, computeFicheForMois]);

  /**
   * For each active employee, compute the list of past months where the
   * salary is still unpaid. Each entry includes the historically-computed
   * fiche so the carryover amount stays correct even if rates/contract change.
   */
  const carryovers = useMemo(() => {
    const map = new Map<string, CarryoverEntry[]>();
    const endYM = prevMois(mois); // months strictly before viewing month

    // Include archived employees so unpaid months stay visible until settled
    const allToCheck = [...activeEmployees, ...archivedEmployees];
    allToCheck.forEach((emp) => {
      if (!emp.date_debut) return;
      const startYM = emp.date_debut.slice(0, 7);
      const monthsList = enumerateMonths(startYM, endYM);
      const result: CarryoverEntry[] = [];

      for (const pastM of monthsList) {
        if (!isEmployeeActiveInMonth(emp, pastM)) continue;
        const adjForMonth = getAdjustmentForMois(emp.id, pastM);
        if (adjForMonth.salaire_paye) continue;

        const fiche = computeFicheForMois(emp, pastM);
        // fiche.acompte is the partial amount already paid; fiche.net_a_payer is what remains
        if (fiche.net_a_payer > 0) {
          result.push({ moisKey: pastM, label: moisLabelFr(pastM), fiche, montant_paye: fiche.acompte });
        }
      }

      if (result.length > 0) map.set(emp.id, result);
    });
    return map;
  }, [activeEmployees, archivedEmployees, mois, getAdjustmentForMois, computeFicheForMois]);

  const getCarryover = useCallback(
    (employeeId: string): CarryoverEntry[] => carryovers.get(employeeId) ?? [],
    [carryovers],
  );

  /** Aggregated totals for État / dashboard (active employees only) */
  const totaux = useMemo(() => {
    let cnss_sal = 0, cnss_emp = 0, irpp = 0, tfp = 0, foprolos = 0, brut = 0, masse_nette = 0, cout = 0;
    let net_paye = 0, acomptes_verses = 0, net_a_payer = 0, carryover = 0;
    activeEmployees.forEach((e) => {
      const f = fiches.get(e.id);
      if (!f) return;
      cnss_sal   += f.cnss_salarie + f.solidarity_salarie;
      cnss_emp   += f.detail_employeur.cnss;
      irpp       += f.irpp_mensuel;
      tfp        += f.detail_employeur.tfp;
      foprolos   += f.detail_employeur.foprolos;
      brut       += f.brut_effectif;
      masse_nette += f.net; // full net before acompte deduction
      cout       += f.cout_total;
      const adj = getAdjustment(e.id);
      if (adj.salaire_paye) {
        // Fully settled: count full net (acompte + remaining transfer)
        net_paye += f.net;
      } else {
        // Not yet fully paid: remaining goes to "Reste à payer"
        net_a_payer += f.net_a_payer;
        // Any acompte already disbursed is counted separately
        if (f.acompte > 0) acomptes_verses += f.acompte;
      }
      const co = carryovers.get(e.id);
      if (co) carryover += co.reduce((s, c) => s + c.fiche.net_a_payer, 0);
    });
    // Also count carryover from archived employees with unpaid history
    archivedEmployees.forEach((e) => {
      const co = carryovers.get(e.id);
      if (co) carryover += co.reduce((s, c) => s + c.fiche.net_a_payer, 0);
    });
    return {
      cnss_salarie:    +cnss_sal.toFixed(3),
      cnss_employeur:  +cnss_emp.toFixed(3),
      cnss_total:      +(cnss_sal + cnss_emp).toFixed(3),
      irpp_total:      +irpp.toFixed(3),
      tfp_total:       +tfp.toFixed(3),
      foprolos_total:  +foprolos.toFixed(3),
      masse_brute:     +brut.toFixed(3),
      masse_nette:     +masse_nette.toFixed(3),
      cout_total:      +cout.toFixed(3),
      /** Net fully settled for paid employees (includes their acompte portions) */
      net_paye:        +net_paye.toFixed(3),
      /** Acomptes already disbursed for employees not yet fully paid */
      acomptes_verses: +acomptes_verses.toFixed(3),
      /** Net still to be paid this month (current month only, after acomptes) */
      net_restant:     +net_a_payer.toFixed(3),
      /** Total carried over from past unpaid months (after their acomptes) */
      net_reporte:     +carryover.toFixed(3),
      /** Net restant + carryover */
      net_total_du:    +(net_a_payer + carryover).toFixed(3),
    };
  }, [fiches, activeEmployees, archivedEmployees, getAdjustment, carryovers]);

  /**
   * Build a fiche snapshot from a fiche for persistence.
   */
  function buildSnapshot(fiche: FichesPaie): FicheSnapshot {
    return {
      snap_brut_effectif: fiche.brut_effectif,
      snap_cnss_salarie:  fiche.cnss_salarie,
      snap_irpp_mensuel:  fiche.irpp_mensuel,
      snap_net_a_payer:   fiche.net_a_payer,
      snap_cout_total:    fiche.cout_total,
    };
  }

  /**
   * Mark salary as paid for the current viewing month, automatically capturing
   * a snapshot of the computed fiche so history stays correct if rates change.
   */
  const marquerPaye = useCallback(
    (employeeId: string, dateISO?: string) => {
      const fiche = fiches.get(employeeId);
      _marquerPaye(employeeId, dateISO, fiche ? buildSnapshot(fiche) : undefined);
    },
    [fiches, _marquerPaye],
  );

  /**
   * Mark salary as paid for any month — used by the multi-month payment modal
   * to settle carryover (reported) months along with the current one.
   */
  const marquerPayeForMois = useCallback(
    (employeeId: string, moisCible: string, fiche: FichesPaie, dateISO?: string) => {
      _marquerPayeForMois(employeeId, moisCible, dateISO, buildSnapshot(fiche));
    },
    [_marquerPayeForMois],
  );

  /**
   * Record a partial salary payment for any month as an acompte.
   * Updates the acompte SalaryElement so the fiche de paie reflects the advance,
   * and recomputes net_a_payer = net - acompte automatically.
   * If the new acompte covers the full net, marks the month as fully paid.
   * Also inserts an audit record in salary_partials.
   */
  const marquerPartiellementPaye = useCallback(
    async (
      employeeId: string,
      moisCible: string,
      amount: number,
      fiche: FichesPaie,
      dateISO: string,
    ) => {
      const dateStr = dateISO.slice(0, 10);
      const adj = getAdjustmentForMois(employeeId, moisCible);

      // Accumulate: existing acompte + new payment
      const existingAcompte = adj.salary_elements.find((e) => e.id === 'acompte')?.amount ?? 0;
      const newAcompte = +(existingAcompte + amount).toFixed(3);

      // Update acompte element in salary_elements
      const updatedElements = adj.salary_elements.map((e) =>
        e.id === 'acompte' ? { ...e, amount: newAcompte, enabled: newAcompte > 0 } : e,
      );

      const isFull = newAcompte >= fiche.net;
      const snapshot = buildSnapshot(fiche);

      // Single combined upsert — avoids the race condition where two separate
      // upsertForMois calls both read stale `data` and the second overwrites
      // the salary_elements update from the first.
      recordAcompteForMois(
        employeeId, moisCible, updatedElements,
        isFull ? fiche.net : newAcompte,
        isFull ? { dateISO, ...snapshot } : undefined,
      );

      // Audit trail
      await addPartial(employeeId, moisCible, amount, dateStr);
    },
    [getAdjustmentForMois, recordAcompteForMois, addPartial],
  );

  return {
    /** All employees (active + archived) — for the Employés tab */
    employees,
    /** Employees active in the selected month — for the Salaires tab */
    activeEmployees,
    /** Employees currently archived — shown in archived section */
    archivedEmployees,
    loading: empLoading || mensuelLoading || historyLoading || baremeLoading || partialsLoading,
    error,
    fiches, totaux,
    addEmployee, updateEmployee, archiveEmployee, restoreEmployee, removeEmployee,
    rates,
    currentBareme, saveBareme, getBaremeForMois, getPayrollSettingsForMonth,
    getAdjustment, getAdjustmentForMois, setElements, resetAdjustment, hasAdjustment,
    marquerPaye, marquerPayeForMois, marquerPartiellementPaye, marquerImpaye,
    getCarryover, partials, getPartials, getPaymentsInPaymentMois,
    getContractForMonth, getEmployeeHistory, addContractChange,
  };
}
