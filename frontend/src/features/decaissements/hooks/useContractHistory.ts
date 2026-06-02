import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { SalaryMode, EmployeePayrollSettings, EmployeePayrollOverrides } from './useEmployeePayrollSettingsDb';

export interface ContractSnapshot {
  salaire_base: number;
  type_contrat: string;
  poste?: string;
  departement?: string;
}

export interface ContractHistoryRow {
  id: string;
  employee_id: string;
  effective_from: string;   // 'YYYY-MM-DD'
  salaire_base: number;
  type_contrat: string;
  poste: string | null;
  departement: string | null;
  note: string | null;
  created_at: string;
  salary_mode: SalaryMode;
  payroll_overrides: EmployeePayrollOverrides;
}

function restoreOverrides(raw: Record<string, unknown>): EmployeePayrollOverrides {
  const out = { ...raw } as EmployeePayrollOverrides;
  if (Array.isArray(out.irpp_brackets)) {
    out.irpp_brackets = out.irpp_brackets.map((b) => ({
      ...b,
      plafond: b.plafond === null ? Infinity : b.plafond,
    }));
  }
  return out;
}

function serializeOverrides(overrides: EmployeePayrollOverrides): Record<string, unknown> {
  const out: Record<string, unknown> = { ...overrides };
  if (Array.isArray(out.irpp_brackets)) {
    out.irpp_brackets = (out.irpp_brackets as any[]).map((b) => ({
      ...b,
      plafond: b.plafond === Infinity ? null : b.plafond,
    }));
  }
  return out;
}

function mapRow(r: any): ContractHistoryRow {
  return {
    id:               r.id,
    employee_id:      r.employee_id,
    effective_from:   r.effective_from,
    salaire_base:     Number(r.salaire_base),
    type_contrat:     r.type_contrat,
    poste:            r.poste ?? null,
    departement:      r.departement ?? null,
    note:             r.note ?? null,
    created_at:       r.created_at,
    salary_mode:      (r.salary_mode as SalaryMode) ?? 'net',
    payroll_overrides: restoreOverrides(r.payroll_overrides ?? {}),
  };
}

export function useContractHistory() {
  const [history, setHistory] = useState<ContractHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { data } = await api.get('/api/contract-history');
        if (!cancelled) setHistory((data ?? []).map(mapRow));
      } catch (e: any) {
        console.error('useContractHistory fetch:', e?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /**
   * Returns the contract terms in effect for an employee in a given month.
   * Finds the most recent history entry where effective_from <= mois.
   * Falls back to `fallback` (the live employee record) when no history exists.
   */
  const getContractForMonth = useCallback(
    (employeeId: string, mois: string, fallback: ContractSnapshot): ContractSnapshot => {
      const entries = history
        .filter(h => h.employee_id === employeeId && h.effective_from.slice(0, 7) <= mois)
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
      return entries.length > 0
        ? {
            salaire_base: entries[0].salaire_base,
            type_contrat: entries[0].type_contrat,
            poste:        entries[0].poste ?? fallback.poste,
            departement:  entries[0].departement ?? fallback.departement,
          }
        : fallback;
    },
    [history],
  );

  /**
   * Returns the payroll settings in effect for an employee in a given month.
   * Finds the most recent history entry where effective_from <= mois.
   * Falls back to defaults when no history exists.
   */
  const getPayrollSettingsForMonth = useCallback(
    (employeeId: string, mois: string): EmployeePayrollSettings => {
      const entries = history
        .filter(h => h.employee_id === employeeId && h.effective_from.slice(0, 7) <= mois)
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
      if (!entries.length) return { salary_mode: 'net', overrides: {} };
      return {
        salary_mode: entries[0].salary_mode,
        overrides:   entries[0].payroll_overrides,
      };
    },
    [history],
  );

  /** All history entries for an employee, newest first */
  const getEmployeeHistory = useCallback(
    (employeeId: string): ContractHistoryRow[] =>
      history
        .filter(h => h.employee_id === employeeId)
        .sort((a, b) => b.effective_from.localeCompare(a.effective_from)),
    [history],
  );

  /**
   * Insert or update a contract-change entry, including optional payroll settings.
   * Payroll settings are stored alongside the contract snapshot so a single
   * temporal lookup covers both contract terms and pay rates.
   */
  const addContractChange = useCallback(async (
    employeeId: string,
    snap: ContractSnapshot,
    effectiveFrom: string,
    note?: string,
    payrollSettings?: EmployeePayrollSettings,
  ): Promise<ContractHistoryRow | null> => {
    try {
      const { data: row } = await api.post('/api/contract-history', {
        employee_id:       employeeId,
        effective_from:    effectiveFrom,
        salaire_base:      snap.salaire_base,
        type_contrat:      snap.type_contrat,
        poste:             snap.poste ?? null,
        departement:       snap.departement ?? null,
        note:              note ?? null,
        salary_mode:       payrollSettings?.salary_mode ?? 'net',
        payroll_overrides: serializeOverrides(payrollSettings?.overrides ?? {}),
      });

      const newRow = mapRow(row);

      setHistory(prev => [
        ...prev.filter(h => !(h.employee_id === employeeId && h.effective_from === effectiveFrom)),
        newRow,
      ]);

      return newRow;
    } catch (e: any) {
      console.error('addContractChange upsert:', e?.message);
      return null;
    }
  }, []);

  return { history, loading, getContractForMonth, getPayrollSettingsForMonth, getEmployeeHistory, addContractChange };
}
