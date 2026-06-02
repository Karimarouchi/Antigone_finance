import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { IrppBracket } from './usePayrollRates';

export type SalaryMode = 'net' | 'base';

export interface EmployeePayrollOverrides {
  cnss_employee?:       number;
  solidarity_employee?: number;
  cnss_employer?:       number;
  tfp?:                 number;
  foprolos?:            number;
  at?:                  number;
  abattement?:          number;
  irpp_brackets?:       IrppBracket[]; // per-employee override only
}

export interface EmployeePayrollSettings {
  salary_mode: SalaryMode;
  overrides:   EmployeePayrollOverrides;
}

interface DbRow {
  id: string;
  employee_id: string;
  effective_from: string; // 'YYYY-MM'
  salary_mode: SalaryMode;
  overrides: EmployeePayrollOverrides;
}

const DEFAULT_SETTINGS: EmployeePayrollSettings = { salary_mode: 'net', overrides: {} };

function restoreOverrides(overrides: Record<string, unknown>): EmployeePayrollOverrides {
  const out: EmployeePayrollOverrides = { ...overrides } as EmployeePayrollOverrides;
  if (Array.isArray(out.irpp_brackets)) {
    out.irpp_brackets = out.irpp_brackets.map((b) => ({
      ...b,
      plafond: b.plafond === null ? Infinity : b.plafond,
    }));
  }
  return out;
}

const rowKey = (employeeId: string, effectiveFrom: string) => `${employeeId}|${effectiveFrom}`;

export function useEmployeePayrollSettingsDb() {
  const [data, setData] = useState<Record<string, DbRow>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/employee-payroll-settings')
      .then(({ data: rows }) => {
        if (cancelled) return;
        const map: Record<string, DbRow> = {};
        (rows ?? []).forEach((r: Record<string, any>) => {
          map[rowKey(r.employee_id, r.effective_from)] = {
            id: r.id,
            employee_id: r.employee_id,
            effective_from: r.effective_from,
            salary_mode: (r.salary_mode as SalaryMode) ?? 'net',
            overrides: restoreOverrides(r.overrides ?? {}),
          };
        });
        setData(map);
        setLoading(false);
      })
      .catch((e) => { console.error('useEmployeePayrollSettingsDb fetch:', e?.message); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /**
   * Temporal lookup: latest settings record where effective_from ≤ mois.
   */
  const getSettingsForMois = useCallback(
    (employeeId: string, mois: string): EmployeePayrollSettings => {
      const applicable = Object.values(data)
        .filter((r) => r.employee_id === employeeId && r.effective_from <= mois)
        .sort((a, b) => a.effective_from.localeCompare(b.effective_from));
      if (!applicable.length) return { ...DEFAULT_SETTINGS };
      const latest = applicable[applicable.length - 1];
      return { salary_mode: latest.salary_mode, overrides: latest.overrides };
    },
    [data],
  );

  /**
   * Upsert settings for a specific employee + month.
   */
  const saveSettings = useCallback(
    async (employeeId: string, effectiveFrom: string, settings: EmployeePayrollSettings) => {
      // Serialize Infinity for JSON storage
      const overrides: Record<string, unknown> = { ...settings.overrides };
      if (Array.isArray(overrides.irpp_brackets)) {
        overrides.irpp_brackets = (overrides.irpp_brackets as IrppBracket[]).map((b) => ({
          ...b,
          plafond: b.plafond === Infinity ? null : b.plafond,
        }));
      }

      try {
        const { data: row } = await api.post('/api/employee-payroll-settings', {
          employee_id: employeeId, effective_from: effectiveFrom, salary_mode: settings.salary_mode, overrides,
        });
        const newRow: DbRow = {
          id: row.id,
          employee_id: row.employee_id,
          effective_from: row.effective_from,
          salary_mode: (row.salary_mode as SalaryMode) ?? 'net',
          overrides: restoreOverrides(row.overrides ?? {}),
        };
        setData((prev) => ({ ...prev, [rowKey(employeeId, effectiveFrom)]: newRow }));
      } catch (e: any) {
        console.error('saveSettings:', e?.message);
      }
    },
    [],
  );

  return { loading, getSettingsForMois, saveSettings };
}
