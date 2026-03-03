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

  is_active?: boolean | null;
  profile_completed?: boolean | null;

  // se tiveres esta coluna
  is_admin?: boolean | null;
};

export type AuthCtx = {
  loading: boolean;
  session: Session | null;
  user: User | null;

  player: Player | null;
  /** role lido da tabela players (normalizado: player | captain | coordinator | admin); "4" é tratado como admin */
  role: string;
  isAdmin: boolean;
  canManageTeam: boolean;
  /** Capitão+: Criar Jogo, Convocatória, Duplas, Resultados */
  canManageSport: boolean;
  /** Coordenador+: Gestão de Pontos de Federação */
  canManageFederationPoints: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;

  // Mantemos ambos para não partires imports antigos
  refreshPlayer: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

async function fetchPlayerByUserId(userId: string): Promise<Player | null> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  const profile = (data as Player) ?? null;
  console.log('Perfil Carregado:', profile ? { id: profile.id, role: profile.role, name: profile.name } : null);
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
  if (profile) return profile;

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
    role: PlayerRoles.player,
    team_id: teamId,
    is_active: true,
    federation_points: 0,
  };

  const { error: upsertError } = await supabase
    .from('players')
    .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: true });

  if (upsertError) {
    console.warn('[AuthContext] upsert perfil base falhou (RLS/constraint):', upsertError.message);
    return null;
  }

  profile = await fetchPlayerByUserId(userId);
  return profile;
}

/**
 * Normaliza o role vindo da BD (string ou número) para o valor canónico usado na app.
 * Prioridade: usa sempre o valor da BD; só devolve 'player' se estiver vazio ou inválido.
 * A BD pode devolver role como string ('1','2','3','4' ou 'player','captain','coordinator','admin') ou número.
 */
function normalizeRole(role: string | number | null | undefined): string {
  if (role === null || role === undefined || role === '') return PlayerRoles.player;
  const r = (role as string).toString().trim().toLowerCase();
  if (r === '4' || r === 'admin' || r === PlayerRoles.admin) return PlayerRoles.admin;
  if (r === '3' || r === 'coordinator' || r === PlayerRoles.coordinator) return PlayerRoles.coordinator;
  if (r === '2' || r === 'captain' || r === PlayerRoles.captain) return PlayerRoles.captain;
  if (r === '1' || r === 'player' || r === PlayerRoles.player) return PlayerRoles.player;
  const num = Number(r);
  if (Number.isInteger(num)) {
    if (num === 4) return PlayerRoles.admin;
    if (num === 3) return PlayerRoles.coordinator;
    if (num === 2) return PlayerRoles.captain;
    if (num === 1) return PlayerRoles.player;
  }
  return PlayerRoles.player;
}

function computeIsAdmin(player: Player | null): boolean {
  if (!player) return false;
  const r = normalizeRole(player.role);
  if (r === PlayerRoles.admin) return true;
  if (player.is_admin) return true;
  return false;
}

function computeCanManageTeam(player: Player | null): boolean {
  if (!player) return false;
  const r = normalizeRole(player.role);
  if (r === PlayerRoles.admin || r === PlayerRoles.coordinator) return true;
  if (player.is_admin) return true;
  return false;
}

function computeCanManageSport(player: Player | null): boolean {
  if (!player) return false;
  const r = normalizeRole(player.role);
  return r === PlayerRoles.captain || r === PlayerRoles.coordinator || r === PlayerRoles.admin;
}

function computeCanManageFederationPoints(player: Player | null): boolean {
  if (!player) return false;
  const r = normalizeRole(player.role);
  return r === PlayerRoles.coordinator || r === PlayerRoles.admin;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);

  const user = session?.user ?? null;
  const role = normalizeRole(player?.role);
  const isAdmin = computeIsAdmin(player);
  const canManageTeam = computeCanManageTeam(player);
  const canManageSport = computeCanManageSport(player);
  const canManageFederationPoints = computeCanManageFederationPoints(player);

  const refreshPlayer = async () => {
    if (!user?.id) {
      setPlayer(null);
      return;
    }
    const p = await ensurePlayerProfile(user.id, user);
    setPlayer(p);
  };

  const refreshProfile = refreshPlayer;

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);

      if (!newSession?.user) {
        setPlayer(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      ensurePlayerProfile(newSession.user.id, newSession.user)
        .then((p) => {
          setPlayer(p);
        })
        .catch((e) => {
          console.error('[AuthContext] ensurePlayerProfile error:', e);
          setPlayer(null);
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
    setSession(null);
    setPlayer(null);
    setLoading(false);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.warn('[AuthContext] signOut:', error.message);
    } catch (e) {
      console.warn('[AuthContext] signOut error:', e);
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
      signIn,
      signUp,
      signOut,
      refreshPlayer,
      refreshProfile,
    }),
    [loading, session, user, player, role, isAdmin, canManageTeam, canManageSport, canManageFederationPoints]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth tem de ser usado dentro de <AuthProvider>');
  return ctx;
}