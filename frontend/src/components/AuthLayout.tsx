import { Outlet } from 'react-router-dom';
import { PublicNavbar } from '@/components/ui/PublicNavbar';

export function AuthLayout() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <PublicNavbar />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
