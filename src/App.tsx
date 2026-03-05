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

import InstallAppPrompt from './components/InstallAppPrompt';
import OfflineBanner from './components/OfflineBanner';

function AppContent() {
  const { session } = useAuth();

  return (
    <div style={{ minHeight: '100vh' }}>
      <NavigationProvider
        routes={{
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
        }}
        initialRouteName="home"
      />

      {/* Mostrar banner e prompt apenas se estiver logado */}
      {session && <OfflineBanner />}
      {session && <InstallAppPrompt />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}