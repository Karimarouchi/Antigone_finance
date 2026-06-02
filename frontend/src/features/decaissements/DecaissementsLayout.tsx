import { Link, Outlet, useLocation } from 'react-router-dom';
import { MoisProvider, useMoisCourant } from './MoisContext';
import { ROUTES } from '@/config/routes';
import './decaissements.css';

const SECTIONS = [
  {
    href: ROUTES.app.decaissements.overview,
    label: "Vue d\u2019ensemble",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    href: ROUTES.app.decaissements.salaires,
    label: 'Salaires',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    href: ROUTES.app.decaissements.chargesFixes,
    label: 'Charges fixes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: ROUTES.app.decaissements.chargesVariables,
    label: 'Charges variables',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
        <polyline points="17 6 23 6 23 12"/>
      </svg>
    ),
  },
  {
    href: ROUTES.app.decaissements.etat,
    label: 'État (Taxes)',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    href: ROUTES.app.decaissements.dettes,
    label: 'Dettes',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
  },
];

function MoisNav() {
  const { label, prev, next, isCurrent, goToCurrent } = useMoisCourant();
  return (
    <div className="dec-mois-nav">
      <button className="dec-mois-btn" onClick={prev} title="Mois précédent" aria-label="Mois précédent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <button
        className={`dec-mois-label${isCurrent ? ' dec-mois-label--current' : ''}`}
        onClick={isCurrent ? undefined : goToCurrent}
        title={isCurrent ? 'Mois en cours' : 'Revenir au mois en cours'}
      >
        {label}
      </button>
      <button className="dec-mois-btn" onClick={next} title="Mois suivant" aria-label="Mois suivant">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>
    </div>
  );
}

function DecaissementsShell() {
  const { pathname } = useLocation();

  return (
    <div className="dec-shell">
      <aside className="dec-sidebar">
        <div className="dec-sidebar-hdr">
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div className="dec-sidebar-title">Décaissements</div>
            <div className="dec-sidebar-sub">Gestion des dépenses</div>
          </div>
        </div>
        <MoisNav />
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
  );
}

export default function DecaissementsLayout() {
  return (
    <MoisProvider>
      <DecaissementsShell />
    </MoisProvider>
  );
}
