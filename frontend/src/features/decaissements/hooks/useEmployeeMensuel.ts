import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { EmployeeMensuel, SalaryElement } from '../types';
import { DEFAULT_SALARY_ELEMENTS } from '../types';

/* ── Snapshot of computed fiche figures saved at payment time ── */
export interface FicheSnapshot {
  snap_brut_effectif: number;
  snap_cnss_salarie:  number;
  snap_irpp_mensuel:  number;
  snap_net_a_payer:   number;
  snap_cout_total:    number;
}

interface DbRow {
  salary_elements: SalaryElement[];
  salaire_paye: boolean;
  date_paiement: string | null;
  montant_paye: number;
  snap_brut_effectif: number;
  snap_cnss_salarie:  number;
  snap_irpp_mensuel:  number;
  snap_net_a_payer:   number;
  snap_cout_total:    number;
}

const EMPTY: DbRow = {
  salary_elements: cloneDefaults(),
  salaire_paye: false,
  date_paiement: null,
  montant_paye: 0,
  snap_brut_effectif: 0,
  snap_cnss_salarie: 0,
  snap_irpp_mensuel: 0,
  snap_net_a_payer: 0,
  snap_cout_total: 0,
};

function cloneDefaults(): SalaryElement[] {
  return DEFAULT_SALARY_ELEMENTS.map((e) => ({ ...e }));
}

/**
 * Merge stored elements with the default catalog so newly-added defaults
 * appear automatically in months that were saved before they existed.
 */
function mergeWithDefaults(stored: SalaryElement[]): SalaryElement[] {
  const byId = new Map(stored.map((e) => [e.id, e]));
  return DEFAULT_SALARY_ELEMENTS.map((def) => {
    const existing = byId.get(def.id);
    if (!existing) return { ...def };
    return { ...def, ...existing };
  }).concat(stored.filter((e) => !DEFAULT_SALARY_ELEMENTS.some((d) => d.id === e.id)));
}

/**
 * Build a SalaryElement[] from the legacy bonus / acompte / jours_absent
 * columns so previously-saved months still calculate correctly.
 */
function legacyToElements(row: Record<string, any>): SalaryElement[] {
  const elements = cloneDefaults();
  const bonus  = Number(row.bonus        ?? 0);
  const acomp  = Number(row.acompte      ?? 0);
  const jours  = Number(row.jours_absent ?? 0);
  if (bonus > 0) {
    const e = elements.find((x) => x.id === 'bonus');
    if (e) { e.amount = bonus; e.enabled = true; }
  }
  if (acomp > 0) {
    const e = elements.find((x) => x.id === 'acompte');
    if (e) { e.amount = acomp; e.enabled = true; }
  }
  if (jours > 0) {
    const e = elements.find((x) => x.id === 'absence');
    if (e) { e.amount = jours; e.enabled = true; }
  }
  return elements;
}

function rowToDbRow(row: Record<string, any>): DbRow {
  const stored = Array.isArray(row.salary_elements) ? row.salary_elements as SalaryElement[] : null;
  const salary_elements = stored && stored.length > 0
    ? mergeWithDefaults(stored)
    : legacyToElements(row);

  return {
    salary_elements,
    salaire_paye:       Boolean(row.salaire_paye),
    date_paiement:      row.date_paiement ?? null,
    montant_paye:       Number(row.montant_paye       ?? 0),
    snap_brut_effectif: Number(row.snap_brut_effectif ?? 0),
    snap_cnss_salarie:  Number(row.snap_cnss_salarie  ?? 0),
    snap_irpp_mensuel:  Number(row.snap_irpp_mensuel  ?? 0),
    snap_net_a_payer:   Number(row.snap_net_a_payer   ?? 0),
    snap_cout_total:    Number(row.snap_cout_total    ?? 0),
  };
}

const keyOf = (employeeId: string, mois: string) => `${employeeId}|${mois}`;

/** Helpers exposed for callers */
export function getElement(elements: SalaryElement[], id: string): SalaryElement | undefined {
  return elements.find((e) => e.id === id);
}

/**
 * Manages per-employee per-month salary elements and payment status.
 * Loads ALL months once so callers can read past-month state for carryover
 * (unpaid salaries from previous months) and pay multiple months at once.
 */
export function useEmployeeMensuel(currentMois: string) {
  const [data, setData] = useState<Record<string, DbRow>>({});
  const [loading, setLoading] = useState(true);

  /* ── Fetch all records once ── */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.get('/api/payroll/salaires/all')
      .then(({ data: rows }) => {
        if (cancelled) return;
        const map: Record<string, DbRow> = {};
        (rows ?? []).forEach((r: Record<string, any>) => { map[keyOf(r.employee_id, r.mois)] = rowToDbRow(r); });
        setData(map);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('useEmployeeMensuel fetch:', e?.message);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  /**
   * Mirror the dynamic elements into the legacy columns so old code paths
   * (and any external reports) keep seeing the canonical bonus/acompte/days values.
   */
  function legacyMirrorFromElements(elements: SalaryElement[]): { bonus: number; acompte: number; jours_absent: number } {
    const e = (id: string) => elements.find((x) => x.id === id);
    const bonus   = e('bonus');
    const acompte = e('acompte');
    const abs     = e('absence');
    return {
      bonus:        bonus   && bonus.enabled   ? bonus.amount   : 0,
      acompte:      acompte && acompte.enabled ? acompte.amount : 0,
      jours_absent: abs     && abs.enabled     ? abs.amount     : 0,
    };
  }

  const upsertForMois = useCallback(
    async (employeeId: string, mois: string, updates: Partial<DbRow>) => {
      const k = keyOf(employeeId, mois);
      const current = data[k] ?? { ...EMPTY, salary_elements: cloneDefaults() };
      const next: DbRow = { ...current, ...updates };
      // Always merge in defaults to keep schema stable
      next.salary_elements = mergeWithDefaults(next.salary_elements);

      // Optimistic update
      setData((prev) => ({ ...prev, [k]: next }));

      const legacy = legacyMirrorFromElements(next.salary_elements);

      try {
        await api.post('/api/payroll/salaires', {
          employee_id:  employeeId,
          mois,
          salary_elements: next.salary_elements,
          // Legacy mirror (kept in sync for backwards compatibility)
          bonus:        legacy.bonus,
          acompte:      legacy.acompte,
          jours_absent: legacy.jours_absent,
          salaire_paye: next.salaire_paye,
          date_paiement: next.date_paiement,
          montant_paye: next.montant_paye,
          snap_brut_effectif: next.snap_brut_effectif,
          snap_cnss_salarie:  next.snap_cnss_salarie,
          snap_irpp_mensuel:  next.snap_irpp_mensuel,
          snap_net_a_payer:   next.snap_net_a_payer,
          snap_cout_total:    next.snap_cout_total,
        });
      } catch (e: any) {
        console.error('useEmployeeMensuel upsert:', e?.message);
        setData((prev) => ({ ...prev, [k]: current }));
      }
    },
    [data],
  );

  /* ── Public API ── */

  const getAdjustmentForMois = useCallback(
    (employeeId: string, mois: string): EmployeeMensuel => {
      const row = data[keyOf(employeeId, mois)] ?? EMPTY;
      return {
        employee_id: employeeId,
        mois,
        salary_elements: row === EMPTY ? cloneDefaults() : row.salary_elements,
        salaire_paye:       row.salaire_paye,
        date_paiement:      row.date_paiement,
        montant_paye:       row.montant_paye,
        snap_brut_effectif: row.snap_brut_effectif,
        snap_cnss_salarie:  row.snap_cnss_salarie,
        snap_irpp_mensuel:  row.snap_irpp_mensuel,
        snap_net_a_payer:   row.snap_net_a_payer,
        snap_cout_total:    row.snap_cout_total,
      };
    },
    [data],
  );

  const getAdjustment = useCallback(
    (employeeId: string): EmployeeMensuel => getAdjustmentForMois(employeeId, currentMois),
    [getAdjustmentForMois, currentMois],
  );

  /** Replace the salary_elements list for the current month */
  const setElements = useCallback(
    (employeeId: string, salary_elements: SalaryElement[]) => {
      upsertForMois(employeeId, currentMois, { salary_elements });
    },
    [upsertForMois, currentMois],
  );

  /** Replace the salary_elements list for any month (used for partial payment acompte updates) */
  const setElementsForMois = useCallback(
    (employeeId: string, mois: string, salary_elements: SalaryElement[]) => {
      upsertForMois(employeeId, mois, { salary_elements });
    },
    [upsertForMois],
  );

  const resetAdjustment = useCallback(
    (employeeId: string) => {
      upsertForMois(employeeId, currentMois, { salary_elements: cloneDefaults() });
    },
    [upsertForMois, currentMois],
  );

  /** True if any element is enabled with a non-zero amount this month */
  const hasAdjustment = useCallback(
    (employeeId: string) => {
      const row = data[keyOf(employeeId, currentMois)];
      if (!row) return false;
      return row.salary_elements.some((e) => e.enabled && e.amount !== 0);
    },
    [data, currentMois],
  );

  const marquerPaye = useCallback(
    (employeeId: string, dateISO?: string, snapshot?: FicheSnapshot) => {
      upsertForMois(employeeId, currentMois, {
        salaire_paye:  true,
        date_paiement: dateISO ?? new Date().toISOString(),
        ...(snapshot ?? {}),
      });
    },
    [upsertForMois, currentMois],
  );

  const marquerPayeForMois = useCallback(
    (employeeId: string, mois: string, dateISO?: string, snapshot?: FicheSnapshot) => {
      upsertForMois(employeeId, mois, {
        salaire_paye:  true,
        date_paiement: dateISO ?? new Date().toISOString(),
        ...(snapshot ?? {}),
      });
    },
    [upsertForMois],
  );

  const marquerImpaye = useCallback(
    (employeeId: string) => {
      upsertForMois(employeeId, currentMois, {
        salaire_paye:       false,
        date_paiement:      null,
        montant_paye:       0,
        snap_brut_effectif: 0,
        snap_cnss_salarie:  0,
        snap_irpp_mensuel:  0,
        snap_net_a_payer:   0,
        snap_cout_total:    0,
      });
    },
    [upsertForMois, currentMois],
  );

  const setMontantPaye = useCallback(
    (employeeId: string, mois: string, montant_paye: number) => {
      upsertForMois(employeeId, mois, { montant_paye });
    },
    [upsertForMois],
  );

  /**
   * Record an acompte payment in a single upsert to avoid the race condition
   * that occurs when salary_elements and montant_paye are updated separately
   * (the second upsert would overwrite the first with stale salary_elements).
   *
   * If `paid` is provided the month is also marked as fully settled.
   */
  const recordAcompteForMois = useCallback(
    (
      employeeId: string,
      mois: string,
      salary_elements: SalaryElement[],
      montant_paye: number,
      paid?: { dateISO: string } & FicheSnapshot,
    ) => {
      upsertForMois(employeeId, mois, {
        salary_elements,
        montant_paye,
        ...(paid
          ? {
              salaire_paye:       true,
              date_paiement:      paid.dateISO,
              snap_brut_effectif: paid.snap_brut_effectif,
              snap_cnss_salarie:  paid.snap_cnss_salarie,
              snap_irpp_mensuel:  paid.snap_irpp_mensuel,
              snap_net_a_payer:   paid.snap_net_a_payer,
              snap_cout_total:    paid.snap_cout_total,
            }
          : {}),
      });
    },
    [upsertForMois],
  );

  /**
   * Scan all loaded salaire_mensuel records and return those that were fully
   * paid (salaire_paye=true) in the given calendar month (YYYY-MM), based on
   * date_paiement. Used by the history section to surface legacy payments that
   * have no salary_partials audit record.
   */
  const getPaymentsInPaymentMois = useCallback(
    (paymentMois: string): Array<{ employeeId: string; salaryMois: string; date_paiement: string; snap_net_a_payer: number; montant_paye: number }> =>
      Object.entries(data)
        .filter(([, row]) => row.salaire_paye && row.date_paiement?.startsWith(paymentMois))
        .map(([key, row]) => {
          const [employeeId, salaryMois] = key.split('|');
          return {
            employeeId,
            salaryMois,
            date_paiement: row.date_paiement!,
            snap_net_a_payer: row.snap_net_a_payer,
            montant_paye: row.montant_paye,
          };
        }),
    [data],
  );

  return {
    loading,
    getAdjustment, getAdjustmentForMois,
    setElements, setElementsForMois, resetAdjustment, hasAdjustment,
    marquerPaye, marquerPayeForMois, marquerImpaye,
    setMontantPaye, recordAcompteForMois, getPaymentsInPaymentMois,
  };
}
