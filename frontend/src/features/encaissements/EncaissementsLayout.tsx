import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import '../decaissements/decaissements.css';

/* ── Enc month context ── */

interface MoisEncValue {
  moisKey: string;
  label: string;
  isCurrentMonth: boolean;
  prev: () => void;
  next: () => void;
  goToCurrent: () => void;
}

const MoisEncContext = createContext<MoisEncValue | null>(null);

export function useMoisEnc(): string {
  const ctx = useContext(MoisEncContext);
  return ctx?.moisKey ?? '';
}

export function useMoisEncFull(): MoisEncValue {
  const ctx = useContext(MoisEncContext);
  if (!ctx) throw new Error('useMoisEncFull must be used inside EncaissementsLayout');
  return ctx;
}

function useMoisNav() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const moisKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const label = useMemo(() => {
    const d = new Date(year, month, 1);
    const s = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }, [year, month]);

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const prev = useCallback(() => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }, [month]);

  const next = useCallback(() => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }, [month]);

  const goToCurrent = useCallback(() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }, [now]);

  return { moisKey, label, isCurrentMonth, prev, next, goToCurrent };
}

const SECTIONS = [
  {
    href: ROUTES.app.encaissements.overview,
    label: "Vue d'ensemble",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    href: ROUTES.app.encaissements.factures,
    label: 'Factures',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    href: ROUTES.app.encaissements.autresRevenus,
    label: 'Autres revenus',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
];

function EncaissementsShell() {
  const { pathname } = useLocation();
  const nav = useMoisNav();

  return (
    <MoisEncContext.Provider value={nav}>
      <div className="dec-shell">
        <aside className="dec-sidebar">
          <div className="dec-sidebar-hdr">
            <div style={{ textAlign: 'center', width: '100%' }}>
              <div className="dec-sidebar-title">Encaissements</div>
              <div className="dec-sidebar-sub">Gestion des revenus</div>
            </div>
          </div>

          <div className="dec-mois-nav">
            <button className="dec-mois-btn" onClick={nav.prev} title="Mois précédent" aria-label="Mois précédent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button
              className={`dec-mois-label${nav.isCurrentMonth ? ' dec-mois-label--current' : ''}`}
              onClick={nav.isCurrentMonth ? undefined : nav.goToCurrent}
              title={nav.isCurrentMonth ? 'Mois en cours' : 'Revenir au mois en cours'}
            >
              {nav.label}
            </button>
            <button className="dec-mois-btn" onClick={nav.next} title="Mois suivant" aria-label="Mois suivant">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>

          <nav className="dec-sidebar-nav">
            {SECTIONS.map((s) => {
              const active = pathname === s.href;
              return (
                <Link
                  key={s.href}
                  to={s.href}
                  className={`dec-sidebar-item${active ? ' active' : ''}`}
                >
                  <span className="dec-sidebar-item-icon">{s.icon}</span>
                  <span className="dec-sidebar-item-label">{s.label}</span>
                  {active && <span className="dec-sidebar-item-dot" />}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="dec-main">
          <Outlet />
        </main>
      </div>
    </MoisEncContext.Provider>
  );
}

export default function EncaissementsLayout() {
  return <EncaissementsShell />;
}
