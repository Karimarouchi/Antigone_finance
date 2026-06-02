import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { IrppBracket } from './usePayrollRates';
import { DEFAULT_RATES } from './usePayrollRates';

interface IrppBaremeRow {
  id: string;
  effective_from: string; // 'YYYY-MM'
  brackets: IrppBracket[];
}

function restoreInfinity(brackets: unknown[]): IrppBracket[] {
  return (brackets as IrppBracket[]).map((b) => ({
    ...b,
    plafond: b.plafond === null ? Infinity : b.plafond,
  }));
}

function serializeBrackets(brackets: IrppBracket[]) {
  return brackets.map((b) => ({ ...b, plafond: b.plafond === Infinity ? null : b.plafond }));
}

export function useIrppBaremesDb() {
  const [baremes, setBaremes] = useState<IrppBaremeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.get('/api/irpp-baremes')
      .then(({ data }) => {
        if (cancelled) return;
        setBaremes(
          (data ?? []).map((r: Record<string, any>) => ({
            id: r.id,
            effective_from: r.effective_from,
            brackets: restoreInfinity((r.brackets as unknown[]) ?? []),
          })),
        );
        setLoading(false);
      })
      .catch((e) => { console.error('useIrppBaremesDb fetch:', e?.message); if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /** Latest brackets globally (for displaying the current barème). */
  const currentBareme: IrppBracket[] =
    baremes.length ? baremes[baremes.length - 1].brackets : DEFAULT_RATES.irpp_brackets;

  /**
   * Temporal lookup: return the brackets that were effective in a given month.
   * Uses the latest record whose effective_from ≤ mois.
   */
  const getBaremeForMois = useCallback(
    (mois: string): IrppBracket[] => {
      const applicable = baremes.filter((b) => b.effective_from <= mois);
      if (!applicable.length) return DEFAULT_RATES.irpp_brackets;
      return applicable[applicable.length - 1].brackets;
    },
    [baremes],
  );

  /**
   * Upsert a barème for the given month.
   */
  const saveBareme = useCallback(async (effectiveFrom: string, brackets: IrppBracket[]) => {
    try {
      const { data } = await api.post('/api/irpp-baremes', {
        effective_from: effectiveFrom,
        brackets: serializeBrackets(brackets),
      });
      const newRow: IrppBaremeRow = {
        id: data.id,
        effective_from: data.effective_from,
        brackets: restoreInfinity((data.brackets as unknown[]) ?? []),
      };
      setBaremes((prev) =>
        [...prev.filter((b) => b.effective_from !== effectiveFrom), newRow]
          .sort((a, b) => a.effective_from.localeCompare(b.effective_from)),
      );
    } catch (e: any) {
      console.error('saveBareme:', e?.message);
    }
  }, []);

  return { loading, currentBareme, getBaremeForMois, saveBareme };
}
