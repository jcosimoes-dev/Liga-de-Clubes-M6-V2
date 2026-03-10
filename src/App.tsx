import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';

import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { CompleteProfileScreen } from './screens/CompleteProfileScreen';
import { AdminScreen } from './screens/AdminScreen';
import { SportManagementScreen } from './screens/SportManagementScreen';
import { GameDetailsScreen } from './screens/GameDetailsScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { TeamScreen } from './screens/TeamScreen';
import { BootstrapScreen } from './screens/BootstrapScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';

import { OfflineScreen } from './screens/OfflineScreen';

import OfflineBanner from './components/OfflineBanner';
import InstallAppPrompt from './components/InstallAppPrompt';
import ConnectionRestoredToast from './components/ConnectionRestoredToast';
import { Loading } from './components/ui/Loading';
import { ProtectedRoute } from './components/ProtectedRoute';

import { useEffect, useState } from "react";

/** Apenas login/register/reset-password (para quando !user; nunca montar game/home). */
const PUBLIC_ROUTES_ONLY = {
  login: LoginScreen,
  register: RegisterScreen,
  'reset-password': ResetPasswordScreen,
};

/** Todas as rotas (privadas ficam dentro de ProtectedRoute). */
const ALL_ROUTES = {
  home: HomeScreen,
  login: LoginScreen,
  register: RegisterScreen,
  'complete-profile': CompleteProfileScreen,
  admin: AdminScreen,
  'sport-management': SportManagementScreen,
  game: GameDetailsScreen,
  calendar: CalendarScreen,
  history: HistoryScreen,
  team: TeamScreen,
  bootstrap: BootstrapScreen,
  'reset-password': ResetPasswordScreen,
};

function AppContent() {
  const { session, loading, user } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (isOffline && !session) {
    return <OfflineScreen />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#121212]">
        <Loading size="lg" text="Carregando..." />
      </div>
    );
  }

  // Curto-circuito: loading false e user null → só LoginScreen (e register/reset para links). Pathname ignorado: forçar URL para /.
  if (!user || !session) {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/');
    }
    return (
      <div style={{ minHeight: '100vh' }}>
        <ConnectionRestoredToast />
        <NavigationProvider routes={PUBLIC_ROUTES_ONLY} initialRouteName="login" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh' }}>
        <ConnectionRestoredToast />
        <NavigationProvider routes={ALL_ROUTES} initialRouteName="login" />
        <OfflineBanner />
        <InstallAppPrompt />
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}