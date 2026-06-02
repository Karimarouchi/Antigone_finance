import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar1 } from '@/components/ui/navbar-1';
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler';
import { usePrivacy } from '@/hooks/usePrivacy';
import WelcomeModal from '@/components/ui/WelcomeModal';
import GlobalMessageBubble from '@/components/ui/GlobalMessageBubble';
import { ROUTES } from '@/config/routes';

export function ProtectedLayout() {
  const { privacyMode, togglePrivacy } = usePrivacy();
  const { pathname } = useLocation();
  const showBubble = pathname !== ROUTES.app.dashboard;

  return (
    <>
      <Navbar1 />
      <WelcomeModal />
      {showBubble && <GlobalMessageBubble />}
      <Suspense fallback={<div className="p-8 text-sm opacity-60">Chargement…</div>}>
        <Outlet />
      </Suspense>

      {/* Privacy mode FAB */}
      <button
        className={`privacy-fab${privacyMode ? ' active' : ''}`}
        onClick={togglePrivacy}
        title={privacyMode ? 'Désactiver mode privé' : 'Activer mode privé'}
      >
        {privacyMode ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
          </svg>
        )}
      </button>

      {/* Theme FAB */}
      <AnimatedThemeToggler className="theme-fab" />
    </>
  );
}
