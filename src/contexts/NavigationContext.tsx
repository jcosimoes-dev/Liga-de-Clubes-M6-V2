import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PlayerRoles } from '../domain/constants';
import { MustChangePasswordBanner } from '../components/MustChangePasswordBanner';

type RouteName = string;

type RouteEntry = { name: RouteName; params?: any };

type NavigationContextType = {
  route: RouteEntry;
  navigate: (options: { name: RouteName; params?: any }) => void;
  /** Voltar atrás (para o separador anterior). Faz scroll ao topo. */
  goBack: () => void;
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

/** Rotas para quem pode gerir jogos (admin, coordenador, capitão). */
const ROUTES_FOR_SPORT_MANAGEMENT: RouteName[] = [
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
  const [route, setRoute] = useState<RouteEntry>(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/reset-password') {
      return { name: 'reset-password' };
    }
    return { name: initialRouteName };
  });

  const historyStackRef = useRef<RouteEntry[]>([]);
  const MAX_HISTORY = 50;

  const { role, session, mustChangePassword, player, canManageSport } = useAuth();
  const isAdmin = (role || '').trim() === PlayerRoles.admin;

  useEffect(() => {
    if (!session) {
      if (route.name !== 'login' && route.name !== 'register' && route.name !== 'reset-password') {
        setRoute({ name: 'login' });
      }
      return;
    }
    if (session && route.name === 'login') {
      setRoute({ name: 'home' });
      return;
    }
    if (isAdmin) return;
    if (player && player.profile_completed === false) {
      if (route.name !== 'complete-profile' && route.name !== 'login' && route.name !== 'register' && route.name !== 'reset-password') {
        setRoute({ name: 'complete-profile' });
      }
    }
  }, [session, route.name, player?.profile_completed, isAdmin]);

  const allowedForRole = [
    ...ROUTES_ALLOWED_FOR_PLAYER,
    ...(canManageSport ? ROUTES_FOR_SPORT_MANAGEMENT : []),
    ...(isAdmin ? ['admin'] : []),
  ];
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
    setRoute((prev) => {
      if (prev.name !== name || JSON.stringify(prev.params) !== JSON.stringify(params)) {
        const stack = historyStackRef.current;
        if (stack.length < MAX_HISTORY) stack.push({ name: prev.name, params: prev.params });
      }
      return { name, params };
    });
  };

  const goBack = () => {
    const stack = historyStackRef.current;
    if (stack.length > 0) {
      const previous = stack.pop()!;
      setRoute(previous);
    } else {
      setRoute({ name: 'home' });
    }
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  const CurrentScreen = routes[route.name];

  if (!CurrentScreen) {
    return <div>Rota inválida: {route.name}</div>;
  }

  if (isForbidden) {
    return (
      <NavigationContext.Provider value={{ route, navigate, goBack }}>
        <div className="flex items-center justify-center min-h-[200px] text-gray-500">A redirecionar...</div>
      </NavigationContext.Provider>
    );
  }

  return (
    <NavigationContext.Provider value={{ route, navigate, goBack }}>
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