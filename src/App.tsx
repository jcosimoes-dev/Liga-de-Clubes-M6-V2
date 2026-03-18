import { HashRouter } from 'react-router-dom';
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
import ProfileLoadErrorBanner from './components/ProfileLoadErrorBanner';
import ProfileLoadErrorScreen from './components/ProfileLoadErrorScreen';
import InstallAppPrompt from './components/InstallAppPrompt';
import ConnectionRestoredToast from './components/ConnectionRestoredToast';
import { WelcomeModal, getHasSeenWelcome } from './components/WelcomeModal';
import { Loading } from './components/ui/Loading';
import { ProtectedRoute } from './components/ProtectedRoute';

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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
  const { session, loading, user, profileLoadError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (user?.id && !getHasSeenWelcome()) setShowWelcomeModal(true);
  }, [user?.id]);

  useEffect(() => {
    const update = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  // Ao abrir a App a partir do link do WhatsApp (?from=whatsapp), limpar o parâmetro da URL para não afetar outros separadores.
  useEffect(() => {
    if (!user) return;
    const search = location.search || '';
    if (!search.includes('from=whatsapp')) return;
    const params = new URLSearchParams(search);
    params.delete('from');
    const newSearch = params.toString();
    const cleanPath = location.pathname + (newSearch ? `?${newSearch}` : '') + (location.hash || '');
    navigate(cleanPath, { replace: true });
  }, [user, location.search, location.pathname, location.hash, navigate]);

  // Sem user e loading concluído: garantir URL raiz (router controla; evita /gestao em sessão fechada).
  useEffect(() => {
    if (!user && !loading && location.pathname !== '/') navigate('/', { replace: true });
  }, [user, loading, location.pathname, navigate]);

  if (!user && !loading) {
    return (
      <div style={{ minHeight: '100vh' }}>
        <ConnectionRestoredToast />
        <NavigationProvider routes={PUBLIC_ROUTES_ONLY} initialRouteName="login" />
      </div>
    );
  }

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

  if (profileLoadError && user) {
    return <ProfileLoadErrorScreen />;
  }

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh' }}>
        <ProfileLoadErrorBanner />
        <ConnectionRestoredToast />
        <NavigationProvider routes={ALL_ROUTES} initialRouteName="home" />
        <OfflineBanner />
        <InstallAppPrompt />
        <WelcomeModal isOpen={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </AuthProvider>
  );
}