import { AuthProvider } from './contexts/AuthContext';
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

/**
 * Fluxo: rota inicial é "home". A HomeScreen redireciona conforme o estado:
 * - Sem sessão → login
 * - Com sessão mas perfil em falta/incompleto (sem preferred_side) → complete-profile
 * - Com sessão e perfil completo na tabela players → fica na Home
 * Jogador (role: player) só pode aceder a home e calendar; outras rotas → Acesso Negado.
 */
export default function App() {
  return (
    <AuthProvider>
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

        {/* Botão de instalar (Android) + instruções (iPhone) */}
        <InstallAppPrompt />
      </div>
    </AuthProvider>
  );
}