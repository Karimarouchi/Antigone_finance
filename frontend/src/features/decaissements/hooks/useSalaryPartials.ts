import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface SalaryPartial {
  id: string;
  employee_id: string;
  mois: string;
  montant: number;
  date: string;
  note: string;
  created_at: string;
}

function mapPartial(r: Record<string, any>): SalaryPartial {
  const date = Array.isArray(r.date)
    ? `${r.date[0]}-${String(r.date[1]).padStart(2, '0')}-${String(r.date[2]).padStart(2, '0')}`
    : (r.date ?? '');
  return {
    id: r.id,
    employee_id: r.employee_id,
    mois: r.mois,
    montant: Number(r.montant ?? 0),
    date,
    note: r.note ?? '',
    created_at: r.created_at ?? '',
  };
}

export function useSalaryPartials() {
  const [partials, setPartials] = useState<SalaryPartial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/payroll/partials')
      .then(({ data }) => {
        if (cancelled) return;
        setPartials((data ?? []).map(mapPartial));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const getPartials = useCallback(
    (employeeId: string, mois: string) =>
      partials.filter((p) => p.employee_id === employeeId && p.mois === mois),
    [partials],
  );

  const getMontantPaye = useCallback(
    (employeeId: string, mois: string) =>
      getPartials(employeeId, mois).reduce((s, p) => s + p.montant, 0),
    [getPartials],
  );

  const addPartial = useCallback(
    async (employeeId: string, mois: string, montant: number, date: string): Promise<SalaryPartial | null> => {
      try {
        const { data } = await api.post('/api/payroll/partials', {
          employee_id: employeeId, mois, montant, date,
        });
        const record = mapPartial(data);
        setPartials((prev) => [...prev, record]);
        return record;
      } catch (e: any) {
        console.error('addPartial:', e?.message);
        return null;
      }
    },
    [],
  );

  return { loading, partials, getPartials, getMontantPaye, addPartial };
}
