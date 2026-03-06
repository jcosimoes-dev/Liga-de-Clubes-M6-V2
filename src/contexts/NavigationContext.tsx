import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PlayerRoles } from '../domain/constants';
import { MustChangePasswordBanner } from '../components/MustChangePasswordBanner';

type RouteName = string;

type NavigationContextType = {
  route: { name: RouteName; params?: any };
  navigate: (options: { name: RouteName; params?: any }) => void;
};

const NavigationContext = createContext<NavigationContextType | null>(null);

const ROUTES_ALLOWED_FOR_PLAYER: RouteName[] = [
  'home',
  'game',
  'calendar',
  'team',
  'history',
  'login',
  'register',
  'complete-profile',
  'reset-password',
];

const ROUTES_ALLOWED_FOR_CAPTAIN_OR_ABOVE: RouteName[] = [
  'admin',
  'sport-management',
  'history',
  'bootstrap',
];

export function NavigationProvider({
  routes,
  initialRouteName,
}: {
  routes: Record<string, any>;
  initialRouteName: string;
}) {
  const [route, setRoute] = useState<{ name: RouteName; params?: any }>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/reset-password') {
      return { name: 'reset-password' };
    }
    return { name: initialRouteName };
  });

  const { role, session, mustChangePassword } = useAuth();

  useEffect(() => {
    if (!session) {
      if (route.name !== 'login' && route.name !== 'register' && route.name !== 'reset-password') {
        setRoute({ name: 'login' });
      }
    }
  }, [session, route.name]);

  const effectiveRole = (role || PlayerRoles.jogador).trim();
  const isPlayerOnly = effectiveRole === PlayerRoles.jogador;
  const allowedForRole = isPlayerOnly
    ? ROUTES_ALLOWED_FOR_PLAYER
    : [...ROUTES_ALLOWED_FOR_PLAYER, ...ROUTES_ALLOWED_FOR_CAPTAIN_OR_ABOVE];
  const isForbidden = route.name != null && !allowedForRole.includes(route.name);

  // Ao criar jogador no Admin, o signUp troca brevemente a sessão para o novo user → role vira player e admin fica "proibido".
  // Atrasar o redirecionamento quando estamos em 'admin' para dar tempo ao AddPlayerModal repor a sessão (setSession) e concluir o upsert.
  // 5s permite redes lentas; quando isForbidden volta a false (sessão restaurada), o cleanup cancela o timeout.
  const ADMIN_REDIRECT_DELAY_MS = 5000;
  useEffect(() => {
    if (!isForbidden) return;
    if (route.name === 'admin') {
      const t = setTimeout(() => setRoute((r) => (r.name === 'admin' ? { name: 'home', params: { accessDenied: true } } : r)), ADMIN_REDIRECT_DELAY_MS);
      return () => clearTimeout(t);
    }
    setRoute({ name: 'home', params: { accessDenied: true } });
  }, [isForbidden, route.name]);

  const navigate = ({ name, params }: { name: RouteName; params?: any }) => {
    setRoute({ name, params });
  };

  const CurrentScreen = routes[route.name];

  if (!CurrentScreen) {
    return <div>Rota inválida: {route.name}</div>;
  }

  if (isForbidden) {
    return (
      <NavigationContext.Provider value={{ route, navigate }}>
        <div className="flex items-center justify-center min-h-[200px] text-gray-500">A redirecionar...</div>
      </NavigationContext.Provider>
    );
  }

  return (
    <NavigationContext.Provider value={{ route, navigate }}>
      {session && mustChangePassword && <MustChangePasswordBanner />}
      <CurrentScreen {...route.params} />
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation tem de ser usado dentro do NavigationProvider');
  }
  return ctx;
}