import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { MIN_PASSWORD_LENGTH } from '../lib/authErrors';
import { PlayerRoles } from '../domain/constants';

export type Player = {
  id: string;
  user_id: string;

  name: string;

  // pode existir ou não no DB — o código NÃO depende disto
  email?: string | null;

  phone?: string | null;
  federation_points?: number | null;
  preferred_side?: string | null;

  role?: string | null;
  team_id?: string | null;
  /** Pontos Liga M6 (calculados: Vitória=10, Derrota=3). Só leitura. */
  liga_points?: number | null;

  is_active?: boolean | null;
  profile_completed?: boolean | null;

  // se tiveres esta coluna
  is_admin?: boolean | null;
  /** Password temporária (reset pelo admin) — jogador deve alterar no perfil */
  must_change_password?: boolean | null;
};

export type AuthCtx = {
  loading: boolean;
  session: Session | null;
  user: User | null;

  player: Player | null;
  /** role lido da tabela players (normalizado: admin | gestor | coordenador | capitao | jogador) */
  role: string;
  isAdmin: boolean;
  canManageTeam: boolean;
  /** Capitão+: Criar Jogo, Convocatória, Duplas, Resultados */
  canManageSport: boolean;
  /** Coordenador+: Gestão de Pontos de Federação */
  canManageFederationPoints: boolean;
  /** Password temporária definida pelo admin — jogador deve alterar no perfil */
  mustChangePassword: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Mantemos ambos para não partires imports antigos
  refreshPlayer: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

/** Hardcoded Admin for project owner. Este e-mail recebe sempre role 'admin', ignorando a BD. */
const HARDCODED_ADMIN_EMAIL = 'jco.simoes@gmail.com';

/** Aplica role admin e team_id null para o dono do projeto, ignorando a BD e cache. Garante acesso total mesmo sem equipa. */
function applyHardcodedAdmin(profile: Player | null, email: string | null | undefined): Player | null {
  const isOwner = (email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL;
  // Hardcoded Admin for project owner: role = admin, team_id = null (limpa equipa antiga 75782791... para evitar 404).
  if (isOwner && profile) {
    return { ...profile, role: PlayerRoles.admin, team_id: null };
  }
  return profile;
}

/** Perfil mínimo para o dono do projeto quando a BD falha ou está vazia — garante que Admin/Gestão continuam acessíveis. */
function syntheticOwnerProfile(userId: string, authUser: { email?: string | null }): Player {
  return {
    id: userId,
    user_id: userId,
    name: (authUser.email ?? 'Admin').split('@')[0] || 'Admin',
    role: PlayerRoles.admin,
    team_id: null,
  } as Player;
}

/**
 * Lê o perfil do utilizador da tabela players (coluna role: 'admin' | 'gestor' | 'coordenador' | 'capitao' | 'jogador').
 * A role é usada para menus e rotas (Gestão de Jogos para admin/coordenador/capitão). Aceita 'coordinator' (EN) → coordenador.
 * No Supabase o perfil está em public.players; não usar tabela profiles para a role.
 */
async function fetchPlayerByUserId(userId: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[AuthContext] fetchPlayerByUserId Supabase error:', {
      message: error.message,
      details: (error as { details?: string }).details,
      hint: (error as { hint?: string }).hint,
      code: (error as { code?: string }).code,
      fullError: error,
    });
    throw error;
  }
  const raw = data as Record<string, unknown> | null;
  const roleValue = raw?.role ?? (raw as { user_role?: string })?.user_role ?? null;
  const profile: Player | null = raw
    ? { ...raw, role: roleValue } as Player
    : null;

  return profile;
}

/**
 * Garante que o utilizador tem perfil em players.
 * 1) SELECT por user_id; se existir, devolve.
 * 2) Se não existir (ou RLS ocultar), faz UPSERT com onConflict: 'user_id' para evitar duplicate key.
 * 3) Volta a fazer SELECT e devolve (player_id fica disponível para availabilities).
 */
async function ensurePlayerProfile(userId: string, authUser: { email?: string | null; user_metadata?: Record<string, unknown> }): Promise<Player | null> {
  let profile = await fetchPlayerByUserId(userId);
  if (profile) return applyHardcodedAdmin(profile, authUser.email);

  const email = (authUser.email ?? '').trim().toLowerCase();
  const name = (authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? email?.split('@')[0] ?? 'Utilizador').toString().trim() || 'Utilizador';
  let teamId: string | null = DEFAULT_TEAM_ID;
  try {
    const { data: teams } = await supabase.from('teams').select('id').limit(1);
    if (teams?.[0]?.id) teamId = teams[0].id;
  } catch {
    // manter DEFAULT_TEAM_ID
  }

  const payload = {
    user_id: userId,
    name: name || 'Utilizador',
    email: email || `${userId}@temp.local`,
    role: PlayerRoles.jogador,
    team_id: teamId,
    is_active: true,
    federation_points: 0,
    preferred_side: 'both',
    profile_completed: false,
  };

  const { error: upsertError } = await supabase
    .from('players')
    .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: true });

  if (upsertError) {
    if ((authUser.email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL) {
      return syntheticOwnerProfile(userId, authUser);
    }
    return null;
  }

  profile = await fetchPlayerByUserId(userId);
  return applyHardcodedAdmin(profile, authUser.email);
}

/**
 * Normaliza o role vindo da BD. Role 'admin' = maior autoridade (único com painel Admin).
 * Valores canónicos: admin, gestor, coordenador, capitao, jogador. Aceita 'coordinator' (EN) → coordenador.
 */
function normalizeRole(role: string | number | null | undefined): string {
  if (role === null || role === undefined) return PlayerRoles.jogador;
  if (typeof role === 'number') {
    if (role === 4) return PlayerRoles.admin;
    if (role === 3) return PlayerRoles.coordenador;
    if (role === 2) return PlayerRoles.capitao;
    if (role === 1) return PlayerRoles.jogador;
    return PlayerRoles.jogador;
  }
  const r = String(role).replace(/\s+/g, ' ').trim().toLowerCase();
  if (!r) return PlayerRoles.jogador;
  if (r === 'admin') return PlayerRoles.admin;
  if (r === 'gestor') return PlayerRoles.gestor;
  if (r === 'coordenador' || r === 'coordinator') return PlayerRoles.coordenador;
  if (r === 'capitao' || r === 'captain') return PlayerRoles.capitao;
  if (r === 'jogador' || r === 'player') return PlayerRoles.jogador;
  const num = Number(r);
  if (Number.isInteger(num)) {
    if (num === 4) return PlayerRoles.admin;
    if (num === 3) return PlayerRoles.coordenador;
    if (num === 2) return PlayerRoles.capitao;
    if (num === 1) return PlayerRoles.jogador;
  }
  return PlayerRoles.jogador;
}

/** Apenas role 'admin' (maior autoridade): painel de Administração, redefinição de passwords, etc. */
function computeIsAdmin(player: Player | null): boolean {
  if (!player) return false;
  const r = normalizeRole(player.role);
  return r === PlayerRoles.admin || Boolean(player.is_admin);
}

/** Admin, Gestor, Coordenador: podem gerir equipa (criar/editar jogadores; apagar só admin). */
function computeCanManageTeam(player: Player | null): boolean {
  if (!player) return false;
  const r = normalizeRole(player.role);
  return r === PlayerRoles.admin || r === PlayerRoles.gestor || r === PlayerRoles.coordenador;
}

/** Admin e Coordenador: gestão de jogos e resultados. Capitão: submeter resultados da sua equipa. */
function computeCanManageSport(player: Player | null): boolean {
  if (!player) return false;
  const r = normalizeRole(player.role);
  return r === PlayerRoles.admin || r === PlayerRoles.coordenador || r === PlayerRoles.capitao;
}

/** Admin, Gestor, Coordenador: podem gerir pontos de federação. */
function computeCanManageFederationPoints(player: Player | null): boolean {
  if (!player) return false;
  const r = normalizeRole(player.role);
  return r === PlayerRoles.admin || r === PlayerRoles.gestor || r === PlayerRoles.coordenador;
}

/** Chaves de localStorage que podem guardar teamId antigo — limpar no login do dono para evitar 404. */
const POSSIBLE_TEAM_CACHE_KEYS = ['app-team-id', 'liga-m6-team-id', 'team_id', 'selectedTeamId'];
/** ID de equipa que já não existe na BD — forçar reset para o dono do projeto. */
const DEAD_TEAM_ID = '75782791-729c-4863-95c5-927690656a81';

function clearOwnerStaleTeamCache(): void {
  if (typeof window === 'undefined') return;
  try {
    POSSIBLE_TEAM_CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    Object.keys(window.localStorage)
      .filter((k) => /team/i.test(k))
      .forEach((k) => window.localStorage.removeItem(k));
    // Limpar qualquer chave cujo valor seja o ID de equipa inválido
    Object.keys(window.localStorage).forEach((k) => {
      if (window.localStorage.getItem(k) === DEAD_TEAM_ID) window.localStorage.removeItem(k);
    });
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  const user = session?.user ?? null;
  const isOwnerEmail = (user?.email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL;
  const role = isOwnerEmail ? PlayerRoles.admin : normalizeRole(player?.role);
  const isAdmin = isOwnerEmail || computeIsAdmin(player);
  const mustChangePassword = player?.must_change_password === true;
  const canManageTeam = isOwnerEmail || computeCanManageTeam(player);
  const canManageSport = isOwnerEmail || computeCanManageSport(player);
  const canManageFederationPoints = isOwnerEmail || computeCanManageFederationPoints(player);

  // Limpeza de memória: ao detetar login do dono, limpar teamId antigo do localStorage e do estado para evitar 404
  useEffect(() => {
    if (user?.email && (user.email.trim().toLowerCase() === HARDCODED_ADMIN_EMAIL)) {
      clearOwnerStaleTeamCache();
      if (player && player.team_id === DEAD_TEAM_ID) {
        setPlayer((prev) => (prev ? { ...prev, team_id: null } : null));
      }
    }
  }, [user?.email, player?.team_id]);

  const refreshPlayer = async () => {
    if (!user?.id) {
      setPlayer(null);
      return;
    }
    const p = await ensurePlayerProfile(user.id, user);
    setPlayer(applyHardcodedAdmin(p, user?.email));
  };

  const refreshProfile = refreshPlayer;

  // Inicial: loading só passa a false DEPOIS de getSession() devolver. Se sessão for nula, user fica null.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return;
      if (!s?.user) {
        setSession(null);
        setPlayer(null);
        setLoading(false);
        return;
      }
      setSession(s);
      if ((s?.user?.email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL) clearOwnerStaleTeamCache();
      ensurePlayerProfile(s.user.id, s.user)
        .then((p) => {
          if (!cancelled) setPlayer(applyHardcodedAdmin(p, s?.user?.email));
        })
        .catch((e) => {
          if (!cancelled) {
            if ((s?.user?.email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL) {
              setPlayer(syntheticOwnerProfile(s.user.id, s.user));
            } else {
              setPlayer(null);
            }
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sincronizar sessão quando outro separador altera o localStorage (ex.: novo separador da App aberto pelo link WhatsApp).
  // Evita que o separador do Admin faça reset para o início: apenas atualizamos a sessão a partir do storage, sem signOut.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key == null || !e.key.includes('auth')) return;
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s ?? null);
        if (!s?.user) {
          setPlayer(null);
          return;
        }
        ensurePlayerProfile(s.user.id, s.user)
          .then((p) => setPlayer(applyHardcodedAdmin(p, s?.user?.email)))
          .catch(() => {
            if ((s?.user?.email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL) {
              setPlayer(syntheticOwnerProfile(s.user.id, s.user));
            } else {
              setPlayer(null);
            }
          });
      });
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession ?? null);

      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setPlayer(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      ensurePlayerProfile(newSession.user.id, newSession.user)
        .then((p) => {
          setPlayer(applyHardcodedAdmin(p, newSession?.user?.email));
        })
        .catch((e) => {
          if ((newSession?.user?.email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL) {
            setPlayer(syntheticOwnerProfile(newSession.user.id, newSession.user));
          } else {
            setPlayer(null);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Perfil é carregado por onAuthStateChange usando user.id (UUID)
  };

  /**
   * Signup directo.
   * Validação de formato (email, password length) deve ser feita no UI; aqui normalizamos e enviamos.
   * Se tens "Confirm email" OFF, normalmente já ficas com sessão e segues.
   */
  const signUp = async (email: string, password: string, name?: string) => {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPassword = typeof password === 'string' ? password : '';
    const displayName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedEmail || !normalizedPassword) {
      throw new Error('Email e palavra-passe são obrigatórios.');
    }
    if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`A palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    // Supabase signUp aceita apenas: email, password, options (emailRedirectTo, data, etc.).
    // O "nome" vai só em options.data (user_metadata); não enviar campos extra no top-level.
    const signUpPayload = {
      email: normalizedEmail,
      password: normalizedPassword,
      ...(displayName ? { options: { data: { name: displayName } } } : {}),
    };
    const { data, error } = await supabase.auth.signUp(signUpPayload);

    if (error) throw error;

    // Se não vier sessão (ex.: Confirm email ON), tenta login direto quando permitido.
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: normalizedPassword,
      });
      if (signInErr) throw signInErr;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  const value = useMemo<AuthCtx>(
    () => ({
      loading,
      session,
      user,
      player,
      role,
      isAdmin,
      canManageTeam,
      canManageSport,
      canManageFederationPoints,
      mustChangePassword,
      signIn,
      signUp,
      signOut,
      refreshPlayer,
      refreshProfile,
    }),
    [loading, session, user, player, role, isAdmin, canManageTeam, canManageSport, canManageFederationPoints, mustChangePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tem de ser usado dentro de <AuthProvider>');
  return ctx;
}