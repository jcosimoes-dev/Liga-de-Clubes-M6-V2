import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

/**
 * Com HashRouter, `location.pathname` é normalmente correcto; em alguns casos fica só "/"
 * e a rota real existe apenas no hash (ex.: "#/jogos/<uuid>"), o que fazia o ecrã de detalhes
 * montar sem `id` (branco para jogadores).
 */
function routingPathname(location: { pathname: string; hash?: string }): string {
  let p = (location.pathname ?? '/').replace(/\/+$/, '') || '/';
  const rawHash =
    (typeof location.hash === 'string' && location.hash.length > 0
      ? location.hash
      : typeof window !== 'undefined'
        ? window.location.hash
        : '') || '';
  const inner = rawHash.replace(/^#/, '').split('?')[0].replace(/\/+$/, '') || '';
  if (inner && (p === '/' || p === '')) {
    return inner.startsWith('/') ? inner : `/${inner}`;
  }
  return p;
}

/** Mapeamento pathname → rota (rota /gestao tratada apenas pelo router da SPA). */
function pathnameToRoute(pathname: string, initialRouteName: string): RouteEntry {
  const p = (pathname ?? '/').replace(/\/+$/, '') || '/';
  if (p === '/reset-password' || p.endsWith('/reset-password')) return { name: 'reset-password' };
  if (p === '/login' || p.endsWith('/login')) return { name: 'login' };
  if (p === '/register' || p.endsWith('/register')) return { name: 'register' };
  if (p === '/gestao' || p.endsWith('/gestao')) return { name: 'sport-management' };
  if (p === '/admin' || p.endsWith('/admin')) return { name: 'admin' };
  if (p === '/calendar' || p.endsWith('/calendar')) return { name: 'calendar' };
  if (p === '/history' || p.endsWith('/history')) return { name: 'history' };
  if (p === '/team' || p.endsWith('/team')) return { name: 'team' };
  if (p === '/bootstrap' || p.endsWith('/bootstrap')) return { name: 'bootstrap' };
  if (p === '/complete-profile' || p.endsWith('/complete-profile')) return { name: 'complete-profile' };
  const gameMatch = p.match(/\/jogos\/([^/]+)\/?$/);
  if (gameMatch) return { name: 'game', params: { id: decodeURIComponent(gameMatch[1]) } };
  if (p === '/' || p === '') return { name: initialRouteName };
  return { name: 'home' };
}

/** Mapeamento rota → path (navegação controlada pelo router; sem pushState directo). */
function routeToPath(name: RouteName, params?: any): string {
  if (name === 'game' && params?.id) return `/jogos/${encodeURIComponent(String(params.id))}`;
  if (name === 'sport-management') return '/gestao';
  if (name === 'reset-password') return '/reset-password';
  if (name === 'login') return '/login';
  if (name === 'register') return '/register';
  if (name === 'complete-profile') return '/complete-profile';
  if (name === 'admin') return '/admin';
  if (name === 'calendar') return '/calendar';
  if (name === 'history') return '/history';
  if (name === 'team') return '/team';
  if (name === 'bootstrap') return '/bootstrap';
  return '/';
}

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
  const location = useLocation();
  const routerNavigate = useNavigate();
  const pathname = routingPathname(location);

  const [route, setRoute] = useState<RouteEntry>(() => pathnameToRoute(pathname, initialRouteName));

  const { role, session, user, mustChangePassword, player, canManageSport, loading: authLoading } = useAuth();
  const isAdmin = (role || '').trim() === PlayerRoles.admin;
  const isOwnerEmail = (user?.email ?? '').trim().toLowerCase() === 'jco.simoes@gmail.com';

  const PUBLIC_ROUTES: RouteName[] = ['login', 'register', 'reset-password'];
  const isPublicRoute = PUBLIC_ROUTES.includes(route.name);

  /** Não redirecionar da rota Admin enquanto o perfil ainda está a carregar (evita bloquear admin por cache/race). */
  const waitForAuthBeforeAdminCheck = route.name === 'admin' && authLoading;

  // Sincronizar estado da rota com pathname + hash (HashRouter / voltar do browser).
  useEffect(() => {
    setRoute(pathnameToRoute(pathname, initialRouteName));
  }, [pathname, location.hash, initialRouteName]);

  // Sem sessão: forçar login e URL raiz (router controla; sem replaceState directo).
  useLayoutEffect(() => {
    if (!session) {
      if (!isPublicRoute) {
        setRoute({ name: 'login' });
        routerNavigate('/', { replace: true });
      }
      return;
    }
    if (session && route.name === 'login') {
      setRoute({ name: 'home' });
      routerNavigate('/', { replace: true });
      return;
    }
    if (isAdmin) return;
    if (player && player.profile_completed === false) {
      // Detalhes do jogo: qualquer utilizador autenticado pode ver (não redireccionar para o perfil).
      if (
        route.name !== 'complete-profile' &&
        route.name !== 'game' &&
        !PUBLIC_ROUTES.includes(route.name)
      ) {
        setRoute({ name: 'complete-profile' });
        routerNavigate('/complete-profile', { replace: true });
      }
    }
  }, [session, route.name, isPublicRoute, player?.profile_completed, isAdmin, routerNavigate]);

  const allowedForRole = [
    ...ROUTES_ALLOWED_FOR_PLAYER,
    ...(canManageSport || isOwnerEmail ? ROUTES_FOR_SPORT_MANAGEMENT : []),
    ...(isAdmin ? ['admin'] : []),
  ];
  /** Enquanto o perfil carrega na rota Admin, não bloquear (evita redirecionar admin por race/cache). */
  const isForbidden = route.name != null && !allowedForRole.includes(route.name) && !waitForAuthBeforeAdminCheck;

  // Coordenador/Capitão/Jogador: Painel Admin oculto; ao aceder via URL redirecionar e mostrar "Acesso Restrito à Administração Principal 🔒".
  const ADMIN_REDIRECT_DELAY_MS = 5000;
  useEffect(() => {
    if (!isForbidden) return;
    if (route.name === 'admin') {
      const isCaptain = role === PlayerRoles.capitao;
      const state = { accessDeniedAdmin: true };
      if (isCaptain) {
        setRoute({ name: 'home', params: { accessDeniedAdmin: true } });
        routerNavigate('/', { replace: true, state });
        return;
      }
      const t = setTimeout(() => {
        setRoute({ name: 'home', params: { accessDeniedAdmin: true } });
        routerNavigate('/', { replace: true, state });
      }, ADMIN_REDIRECT_DELAY_MS);
      return () => clearTimeout(t);
    }
    setRoute({ name: 'home', params: { accessDenied: true } });
    routerNavigate('/', { replace: true, state: { accessDenied: true } });
  }, [isForbidden, route.name, role, routerNavigate]);

  const navigate = ({ name, params, state }: { name: RouteName; params?: any; state?: any }) => {
    setRoute({ name, params: { ...params, ...state } });
    const path = routeToPath(name, params);
    routerNavigate(path, state != null ? { state } : undefined);
  };

  const goBack = () => {
    window.scrollTo(0, 0);
    routerNavigate(-1);
  };

  // Sem sessão em rota protegida: mostrar Login imediatamente (evita flash do ecrã anterior)
  const effectiveRoute = !session && !isPublicRoute ? { name: 'login' as RouteName } : route;
  const CurrentScreen = routes[effectiveRoute.name];

  if (!CurrentScreen) {
    return <div>Rota inválida: {effectiveRoute.name}</div>;
  }

  if (isForbidden) {
    return (
      <NavigationContext.Provider value={{ route, navigate, goBack }}>
        <div className="flex items-center justify-center min-h-[200px] text-gray-500">A redirecionar...</div>
      </NavigationContext.Provider>
    );
  }

  const screenProps = { ...effectiveRoute.params, ...(location.state || {}) };
  return (
    <NavigationContext.Provider value={{ route, navigate, goBack }}>
      {session && mustChangePassword && <MustChangePasswordBanner />}
      <CurrentScreen {...screenProps} />
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