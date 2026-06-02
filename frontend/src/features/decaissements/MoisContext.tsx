import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

const LS_KEY = 'dec_mois_courant';

function todayMois(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(mois: string, delta: number): string {
  const [y, m] = mois.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const FR_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function moisLabel(mois: string): string {
  const [y, m] = mois.split('-').map(Number);
  return `${FR_MONTHS[m - 1]} ${y}`;
}

interface MoisContextValue {
  mois: string;
  setMois: (m: string) => void;
  label: string;
  prev: () => void;
  next: () => void;
  isCurrent: boolean;
  goToCurrent: () => void;
}

const MoisContext = createContext<MoisContextValue | null>(null);

export function MoisProvider({ children }: { children: React.ReactNode }) {
  const [mois, setMoisRaw] = useState<string>(todayMois);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored && stored !== mois) setMoisRaw(stored);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setMois = useCallback((m: string) => {
    setMoisRaw(m);
    localStorage.setItem(LS_KEY, m);
  }, []);

  const prev = useCallback(() => setMois(addMonths(mois, -1)), [mois, setMois]);
  const next = useCallback(() => setMois(addMonths(mois, +1)), [mois, setMois]);
  const goToCurrent = useCallback(() => setMois(todayMois()), [setMois]);

  const label = useMemo(() => moisLabel(mois), [mois]);
  const isCurrent = mois === todayMois();

  return (
    <MoisContext.Provider value={{ mois, setMois, label, prev, next, isCurrent, goToCurrent }}>
      {children}
    </MoisContext.Provider>
  );
}

export function useMoisCourant(): MoisContextValue {
  const ctx = useContext(MoisContext);
  if (!ctx) throw new Error('useMoisCourant must be used inside MoisProvider');
  return ctx;
}
