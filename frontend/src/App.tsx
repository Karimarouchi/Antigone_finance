import { AuthProvider } from '@/context/AuthContext';
import { SharedProvider } from '@/context/SharedContext';
import { AppRouter } from '@/router';

export default function App() {
  return (
    <AuthProvider>
      <SharedProvider>
        <AppRouter />
      </SharedProvider>
    </AuthProvider>
  );
}
