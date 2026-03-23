import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Pontos Liga M6 (automático em jogos da Liga; ajustável na Equipa por admin/gestor/coordenador). */
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
  /** Regras centralizadas: capitão só pode Criar Jogo, Abrir Convocatória, Registar Resultados */
  canDo: (action: SportAction) => boolean;
  /** Erro de carregamento de perfil (ex.: recursão RLS 42P17) — mostrar ao utilizador e evitar loops */
  profileLoadError: string | null;

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

/** Aplica role admin e team_id null para o dono do projeto, ignorando a BD. Garante acesso total mesmo sem equipa. */
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

/** Mecanismo de segurança: se falhar com 42P17, não voltar a tentar (evita loop infinito). */
let profileFetchBlocked = false;
function setProfileFetchBlocked(v: boolean) {
  profileFetchBlocked = v;
}

/**
 * Lê o perfil do utilizador da tabela players (coluna role: 'admin' | 'gestor' | 'coordenador' | 'capitao' | 'jogador').
 * Query simples: select().eq('user_id', uid).maybeSingle() — sem funções complexas de filtro.
 * Se profileFetchBlocked, falha imediatamente sem tentar (evita loop).
 */
async function fetchPlayerByUserId(userId: string): Promise<Player | null> {
  if (profileFetchBlocked) {
    const err = new Error('Recursão RLS bloqueada — não voltar a tentar.') as Error & { code?: string };
    err.code = '42P17';
    throw err;
  }
  const { data, error } = await supabase
    .from('players')
    .select('id, user_id, name, email, role, team_id, phone, federation_points, preferred_side, is_active, profile_completed, must_change_password, liga_points')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[AuthContext] fetchPlayerByUserId Supabase error:', {
      message: error.message,
      code: (error as { code?: string }).code,
    });
    throw error;
  }
  const raw = data as Record<string, unknown> | null;
  const roleValue = raw?.role ?? (raw as { user_role?: string })?.user_role ?? null;
  const profile: Player | null = raw
    ? { ...raw, role: roleValue } as Player
    : null;

  // Diagnóstico: log da linha encontrada (ou null) para user_id
  if (typeof console !== 'undefined' && console.log) {
    console.log('[AuthContext.fetchPlayerByUserId]', {
      auth_user_id: userId,
      found: !!raw,
      player_id: raw?.id ?? null,
      player_user_id: raw?.user_id ?? null,
      player_email: raw?.email ?? null,
      player_role: roleValue ?? null,
      player_role_RAW: raw?.role ?? null,
    });
  }
  return profile;
}

const ELEVATED_ROLES = new Set([PlayerRoles.admin, PlayerRoles.gestor, PlayerRoles.coordenador, PlayerRoles.capitao]);

/**
 * Garante que o utilizador tem perfil em players.
 * - Se existir linha por user_id: devolve (NUNCA sobrescrever role).
 * - Se não existir: procura linha por email; se existir (ex.: admin com user_id antigo), associa user_id e devolve.
 * - Só então: INSERT com role jogador; em conflito refetch e devolve.
 */
async function ensurePlayerProfile(userId: string, authUser: { email?: string | null; user_metadata?: Record<string, unknown> }): Promise<Player | null> {
  let profile = await fetchPlayerByUserId(userId);
  if (profile) {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[AuthContext.ensurePlayerProfile] Perfil já existe por user_id. role=%s (NENHUMA escrita).', profile.role);
    }
    return applyHardcodedAdmin(profile, authUser.email);
  }

  const email = (authUser.email ?? '').trim().toLowerCase();
  if (!email) {
    if (typeof console !== 'undefined' && console.log) {
      console.log('[AuthContext.ensurePlayerProfile] Sem email; não procurar por email. user_id=%s', userId);
    }
  } else {
    // Associar linha existente por email (evitar segunda linha com role jogador para o mesmo utilizador)
    const { data: byEmail } = await supabase
      .from('players')
      .select('id, user_id, email, role')
      .eq('email', email)
      .limit(2);

    const rows = (byEmail ?? []) as { id: string; user_id: string | null; email: string | null; role: string | null }[];
    if (typeof console !== 'undefined' && console.log) {
      console.log('[AuthContext.ensurePlayerProfile] Linhas com este email (players.email=%s):', email, rows.length, rows.map((r) => ({ id: r.id, user_id: r.user_id, role: r.role })));
    }
    if (rows.length >= 1) {
      const row = rows[0];
      if (row.user_id !== userId) {
        console.log('[AuthContext.ensurePlayerProfile] Associar linha existente ao auth user: players.id=%s, role=%s, user_id antigo=%s -> novo=%s (RPC link_player_profile_by_email).', row.id, row.role, row.user_id, userId);
        const { data: linked, error: linkErr } = await supabase.rpc('link_player_profile_by_email');
        if (linkErr) {
          console.warn('[AuthContext.ensurePlayerProfile] RPC link_player_profile_by_email erro:', linkErr.message, linkErr.code);
        } else if (linked && Array.isArray(linked) && linked.length > 0) {
          const raw = linked[0] as Record<string, unknown>;
          const roleValue = raw?.role ?? null;
          profile = { ...raw, role: roleValue } as Player;
          console.log('[AuthContext.ensurePlayerProfile] Após RPC link: player.id=%s, role=%s (NÃO inserir jogador).', profile.id, profile.role);
          return applyHardcodedAdmin(profile, authUser.email);
        }
        profile = await fetchPlayerByUserId(userId);
        if (profile) return applyHardcodedAdmin(profile, authUser.email);
      }
    }
  }

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

  console.log('[AuthContext.ensurePlayerProfile] ESCREVENDO INSERT: user_id=%s, email=%s, role=%s. Payload completo:', userId, email, payload.role, payload);

  let insertError: { code?: string; message?: string } | null = null;
  try {
    const result = await supabase.from('players').insert(payload);
    insertError = result.error as { code?: string; message?: string } | null;
    if (insertError) {
      console.error('Erro detalhado no INSERT (players):', insertError);
    }
  } catch (err) {
    console.error('Erro detalhado no INSERT (players):', err);
    insertError = err as { code?: string; message?: string };
  }

  if (insertError) {
    const code = insertError?.code;
    if (code === '42501') {
      if (typeof window !== 'undefined' && window.alert) {
        window.alert('Erro de permissão no Supabase: Verifica as políticas RLS.');
      }
      throw new Error('Erro de permissão no Supabase (42501). Verifica as políticas RLS.');
    }
    if (code === '23505') {
      console.log('[AuthContext.ensurePlayerProfile] Conflito 23505: linha já existe para user_id=%s — refetch, NÃO escrever role.', userId);
      profile = await fetchPlayerByUserId(userId);
      return applyHardcodedAdmin(profile, authUser.email);
    }
    if ((authUser.email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL) {
      return syntheticOwnerProfile(userId, authUser);
    }
    return null;
  }

  profile = await fetchPlayerByUserId(userId);
  const out = applyHardcodedAdmin(profile, authUser.email);
  console.log('[AuthContext.ensurePlayerProfile] Após INSERT: profile.role=%s, applyHardcodedAdmin result role=%s', profile?.role ?? null, out?.role ?? null);
  return out;
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

/** Ações que podem ser restritas por role (ex.: capitão vs coordenador/admin). */
export type SportAction =
  | 'edit_other_player'
  | 'delete_player'
  | 'create_game'
  | 'open_convocation'
  | 'register_results'
  | 'edit_game'
  | 'delete_game'
  | 'close_convocation'
  | 'emergency_substitution'
  | 'access_admin';

/**
 * Centraliza permissões por ação. Capitão: só Criar Jogo, Abrir Convocatória e Registar Resultados.
 * Bloqueados para capitão: Editar/Apagar Jogo, Anular Convocatória, Substituição de Emergência, Admin.
 */
export function canAction(player: Player | null, effectiveRole: string, action: SportAction): boolean {
  if (!player) return false;
  const r = normalizeRole(effectiveRole);

  switch (action) {
    case 'edit_other_player':
    case 'delete_player':
      return r === PlayerRoles.admin || r === PlayerRoles.gestor || r === PlayerRoles.coordenador;
    case 'create_game':
    case 'open_convocation':
    case 'register_results':
      return r === PlayerRoles.admin || r === PlayerRoles.coordenador || r === PlayerRoles.capitao;
    case 'edit_game':
    case 'delete_game':
    case 'close_convocation':
    case 'emergency_substitution':
      return r === PlayerRoles.admin || r === PlayerRoles.coordenador;
    case 'access_admin':
      return r === PlayerRoles.admin;
    default:
      return false;
  }
}

/** Mensagem padrão para ações bloqueadas ao capitão. */
export const RESTRICTED_COORDINATION_MSG = 'Acesso restrito à Coordenação';

/** Mensagem quando coordenador/capitão/jogador tenta aceder ao Painel Admin via URL. */
export const RESTRICTED_ADMIN_MSG = 'Acesso Restrito à Administração Principal 🔒';

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
    // Limpar qualquer chave cujo valor seja o ID de equipa inválida
    Object.keys(window.localStorage).forEach((k) => {
      if (window.localStorage.getItem(k) === DEAD_TEAM_ID) window.localStorage.removeItem(k);
    });
  } catch {
    // ignore
  }
}

/** Chaves de localStorage que podem guardar cargo/role — limpar no login para forçar leitura fresca do Supabase. */
const ROLE_CACHE_KEYS = ['liga-m6-role', 'app-role', 'liga-m6-player-role', 'liga-m6-user-role'];

function clearRoleCache(): void {
  if (typeof window === 'undefined') return;
  try {
    ROLE_CACHE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    Object.keys(window.localStorage)
      .filter((k) => /role|player-role|cargo/i.test(k))
      .forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

const RLS_RECURSION_CODE = '42P17';
const MAX_PROFILE_LOAD_FAILURES = 3;
const PROFILE_LOAD_ERROR_MSG = 'Erro ao carregar perfil. Verifica as políticas RLS no Supabase ou contacta o administrador.';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [profileLoadError, setProfileLoadError] = useState<string | null>(null);
  const lastPlayerUserIdRef = useRef<string | null>(null);
  const profileLoadFailuresRef = useRef(0);
  const profileLoadBlockedRef = useRef(false);

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
    if (profileLoadBlockedRef.current) return;
    try {
      const p = await ensurePlayerProfile(user.id, user);
      profileLoadFailuresRef.current = 0;
      setProfileLoadError(null);
      setPlayer(applyHardcodedAdmin(p, user?.email));
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === RLS_RECURSION_CODE) {
        profileLoadBlockedRef.current = true;
        setProfileFetchBlocked(true);
        setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
        return;
      }
      profileLoadFailuresRef.current += 1;
      if (profileLoadFailuresRef.current >= MAX_PROFILE_LOAD_FAILURES) {
        profileLoadBlockedRef.current = true;
        setProfileFetchBlocked(true);
        setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
      }
      throw e;
    }
  };

  const refreshProfile = refreshPlayer;

  // Inicial: loading só passa a false DEPOIS de getSession() devolver. Se sessão for nula, user fica null.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return;
      if (!s?.user) {
        lastPlayerUserIdRef.current = null;
        setSession(null);
        setPlayer(null);
        setLoading(false);
        return;
      }
      const authId = s.user.id;
      const authEmail = (s?.user?.email ?? '').trim().toLowerCase();
      console.log('[AuthContext] getSession: auth user id=%s, email=%s', authId, authEmail);
      setSession(s);
      if (authEmail === HARDCODED_ADMIN_EMAIL) clearOwnerStaleTeamCache();
      if (profileLoadBlockedRef.current) {
        if (!cancelled) {
          setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
          setPlayer(authEmail === HARDCODED_ADMIN_EMAIL ? syntheticOwnerProfile(s.user.id, s.user) : null);
        }
        setLoading(false);
        return;
      }
      ensurePlayerProfile(s.user.id, s.user)
        .then((p) => {
          if (cancelled) return;
          profileLoadFailuresRef.current = 0;
          setProfileLoadError(null);
          const final = applyHardcodedAdmin(p, s?.user?.email);
          if (final?.user_id) lastPlayerUserIdRef.current = final.user_id;
          console.log('[AuthContext] setPlayer (inicial): player.id=%s, player.user_id=%s, player.email=%s, player.role=%s', final?.id ?? null, final?.user_id ?? null, final?.email ?? null, final?.role ?? null);
          setPlayer(final);
        })
        .catch(async (e) => {
          if (!cancelled) {
            const code = (e as { code?: string })?.code;
            if (code === RLS_RECURSION_CODE) {
              profileLoadBlockedRef.current = true;
              setProfileFetchBlocked(true);
              setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
              setPlayer(authEmail === HARDCODED_ADMIN_EMAIL ? syntheticOwnerProfile(s.user.id, s.user) : null);
              return;
            }
            profileLoadFailuresRef.current += 1;
            if (profileLoadFailuresRef.current >= MAX_PROFILE_LOAD_FAILURES) {
              profileLoadBlockedRef.current = true;
              setProfileFetchBlocked(true);
              setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
            }
            if ((s?.user?.email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL) {
              setPlayer(syntheticOwnerProfile(s.user.id, s.user));
              lastPlayerUserIdRef.current = s.user.id;
            } else {
              const { data: { session: nowSession } } = await supabase.auth.getSession();
              if (nowSession?.user?.id !== s.user.id) return;
              if (s.user.id === lastPlayerUserIdRef.current) return;
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
      if (profileLoadBlockedRef.current) return;
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s ?? null);
        if (!s?.user) {
          lastPlayerUserIdRef.current = null;
          setPlayer(null);
          return;
        }
        if (profileLoadBlockedRef.current) return;
        ensurePlayerProfile(s.user.id, s.user)
          .then((p) => {
            profileLoadFailuresRef.current = 0;
            setProfileLoadError(null);
            const final = applyHardcodedAdmin(p, s?.user?.email);
            if (final?.user_id) lastPlayerUserIdRef.current = final.user_id;
            setPlayer(final);
          })
          .catch(async (e) => {
            const code = (e as { code?: string })?.code;
            if (code === RLS_RECURSION_CODE) {
              profileLoadBlockedRef.current = true;
              setProfileFetchBlocked(true);
              setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
            } else {
              profileLoadFailuresRef.current += 1;
              if (profileLoadFailuresRef.current >= MAX_PROFILE_LOAD_FAILURES) {
                profileLoadBlockedRef.current = true;
                setProfileFetchBlocked(true);
                setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
              }
            }
            const authEmail = (s?.user?.email ?? '').trim().toLowerCase();
            if (authEmail === HARDCODED_ADMIN_EMAIL) {
              setPlayer(syntheticOwnerProfile(s.user.id, s.user));
              lastPlayerUserIdRef.current = s.user.id;
            } else {
              const { data: { session: nowSession } } = await supabase.auth.getSession();
              if (nowSession?.user?.id !== s.user.id) return;
              if (s.user.id === lastPlayerUserIdRef.current) return;
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
        lastPlayerUserIdRef.current = null;
        profileLoadBlockedRef.current = false;
        profileLoadFailuresRef.current = 0;
        setProfileFetchBlocked(false);
        setProfileLoadError(null);
        setPlayer(null);
        setLoading(false);
        return;
      }

      const authId = newSession.user.id;
      const authEmail = (newSession?.user?.email ?? '').trim().toLowerCase();
      console.log('[AuthContext] onAuthStateChange: event=%s, auth user id=%s, email=%s', event, authId, authEmail);
      if (event === 'SIGNED_IN') {
        clearRoleCache();
      }
      if (profileLoadBlockedRef.current) {
        setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
        setPlayer(authEmail === HARDCODED_ADMIN_EMAIL ? syntheticOwnerProfile(newSession.user.id, newSession.user) : null);
        setLoading(false);
        return;
      }
      setLoading(true);
      ensurePlayerProfile(newSession.user.id, newSession.user)
        .then((p) => {
          profileLoadFailuresRef.current = 0;
          setProfileLoadError(null);
          const final = applyHardcodedAdmin(p, newSession?.user?.email);
          if (final?.user_id) lastPlayerUserIdRef.current = final.user_id;
          console.log('[AuthContext] setPlayer (onAuthStateChange): player.id=%s, player.user_id=%s, player.email=%s, player.role=%s', final?.id ?? null, final?.user_id ?? null, final?.email ?? null, final?.role ?? null);
          setPlayer(final);
        })
        .catch(async (e) => {
          const code = (e as { code?: string })?.code;
          if (code === RLS_RECURSION_CODE) {
            profileLoadBlockedRef.current = true;
            setProfileFetchBlocked(true);
            setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
          } else {
            profileLoadFailuresRef.current += 1;
            if (profileLoadFailuresRef.current >= MAX_PROFILE_LOAD_FAILURES) {
              profileLoadBlockedRef.current = true;
              setProfileFetchBlocked(true);
              setProfileLoadError(PROFILE_LOAD_ERROR_MSG);
            }
          }
          if ((newSession?.user?.email ?? '').trim().toLowerCase() === HARDCODED_ADMIN_EMAIL) {
            setPlayer(syntheticOwnerProfile(newSession.user.id, newSession.user));
            lastPlayerUserIdRef.current = newSession.user.id;
          } else {
            const { data: { session: nowSession } } = await supabase.auth.getSession();
            if (nowSession?.user?.id !== newSession.user.id) return;
            if (newSession.user.id === lastPlayerUserIdRef.current) return;
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
      canDo: (action: SportAction) => canAction(player, role, action),
      profileLoadError,
      signIn,
      signUp,
      signOut,
      refreshPlayer,
      refreshProfile,
    }),
    [loading, session, user, player, role, isAdmin, canManageTeam, canManageSport, canManageFederationPoints, mustChangePassword, profileLoadError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tem de ser usado dentro de <AuthProvider>');
  return ctx;
}