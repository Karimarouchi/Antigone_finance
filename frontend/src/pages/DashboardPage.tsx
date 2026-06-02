import { useAuth } from '@/context/AuthContext';
import ShortcutsCard from '@/features/home/ShortcutsCard';
import NotificationsCard from '@/features/home/NotificationsCard';
import NotesSection from '@/features/home/NotesSection';
import '@/features/home/dashboard.css';

export default function DashboardPage() {
  const { user } = useAuth();
  // Match original: hasWidgetAccess = !!user
  const hasWidgetAccess = !!user;

  return (
    <div className="home-page">
      <div className={`home-layout${hasWidgetAccess ? '' : ' home-layout--centered'}`}>
        <ShortcutsCard />
        <div className="home-layout-right">
          <NotificationsCard />
        </div>
      </div>
      <div className="home-bottom-row">
        <div className="home-bottom-center">
          <NotesSection />
        </div>
      </div>
    </div>
  );
}
