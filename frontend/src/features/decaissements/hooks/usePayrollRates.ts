import { useState, useCallback } from 'react';

export interface IrppBracket {
  plafond: number;
  taux: number;
}

export interface PayrollRates {
  cnss_employee: number;       // part salarié CNSS   — ex: 0.0918
  solidarity_employee: number; // contribution solidarité salarié — ex: 0.0050
  cnss_employer: number;       // part patronale CNSS (consolidée) — ex: 0.1657
  tfp: number;                 // taxe formation professionnelle — ex: 0.01
  foprolos: number;            // FOPROLOS — ex: 0.01
  at: number;                  // accidents de travail — ex: 0.004
  abattement: number;          // déduction forfaitaire sur salaire imposable — ex: 0.10
  irpp_brackets: IrppBracket[];
  effective_from: string;      // ISO date
  notes: string;
}

export const DEFAULT_RATES: PayrollRates = {
  cnss_employee: 0.0918,
  solidarity_employee: 0.0050,
  cnss_employer: 0.1657,
  tfp: 0.01,
  foprolos: 0.01,
  at: 0.004,
  abattement: 0.10,
  irpp_brackets: [
    { plafond: 5000,     taux: 0    },
    { plafond: 10000,    taux: 0.15 },
    { plafond: 20000,    taux: 0.25 },
    { plafond: 30000,    taux: 0.30 },
    { plafond: 40000,    taux: 0.33 },
    { plafond: 50000,    taux: 0.36 },
    { plafond: 70000,    taux: 0.38 },
    { plafond: Infinity, taux: 0.40 },
  ],
  effective_from: '2026-01-01',
  notes: 'Barème IRPP 2026 — Tunisie',
};

const LS_KEY = 'dec_payroll_rates_v1';

export function usePayrollRates() {
  const [rates, setRates] = useState<PayrollRates>(() => {
    if (typeof window === 'undefined') return DEFAULT_RATES;
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // JSON serialises Infinity as null — restore it
        if (Array.isArray(parsed.irpp_brackets)) {
          parsed.irpp_brackets = parsed.irpp_brackets.map((b: IrppBracket) => ({
            ...b,
            plafond: b.plafond === null ? Infinity : b.plafond,
          }));
        }
        // Merge so that new fields added to DEFAULT_RATES are included
        return { ...DEFAULT_RATES, ...parsed };
      }
    } catch {}
    return DEFAULT_RATES;
  });

  const updateRates = useCallback((updates: Partial<PayrollRates>) => {
    setRates((prev) => {
      const next = { ...prev, ...updates };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetRates = useCallback(() => {
    setRates(DEFAULT_RATES);
    try { localStorage.removeItem(LS_KEY); } catch {}
  }, []);

  return { rates, updateRates, resetRates };
}
