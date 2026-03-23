import { supabase } from '../lib/supabase';
import type { Player } from '../lib/database.types';
import { GESTOR_HIDE_EMAIL } from '../lib/gestorFilter';
import { PlayerRoles, validateRole, validatePreferredSide, type PlayerRole } from '../domain/constants';

/** Colunas editáveis no update de perfil (client). role só via updateRole ou admin. */
const ALLOWED_PLAYER_UPDATE_KEYS = [
  'name',
  'phone',
  'preferred_side',
  'federation_points',
  'liga_points',
  'is_active',
  'must_change_password',
] as const;

/** Campos que o Supabase rejeita por RLS para utilizadores não-Admin — nunca enviar no .update(). */
const RESTRICTED_KEYS = ['id', 'user_id', 'role', 'created_at', 'updated_at', 'email'] as const;

export const PlayersService = {
  /**
   * Obter todos os jogadores
   */
  async getAll() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .neq('email', GESTOR_HIDE_EMAIL)
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Obter todos os jogadores activos
   */
  async getActive() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('is_active', true)
      .neq('email', GESTOR_HIDE_EMAIL)
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Obter jogadores da equipa (para dropdowns e gestão).
   * Usa REST directo para evitar 404 de RPC get_team_players.
   * teamId opcional: se omitido, devolve todos (útil para fallback).
   */
  async getTeamPlayers(teamId?: string) {
    let q = supabase.from('players').select('*').neq('email', GESTOR_HIDE_EMAIL);
    if (teamId) q = q.eq('team_id', teamId);
    const { data, error } = await q.order('name');
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Obter todos os jogadores (para admins na secção Gestão).
   * Usa apenas REST padrão (rest/v1/players) para evitar 404 de RPCs.
   */
  async getTeamPlayersForAdmin() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .neq('email', GESTOR_HIDE_EMAIL)
      .order('name');

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Obter jogador por ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Obter jogador por user_id
   */
  async getByUserId(userId: string) {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar perfil do jogador.
   * Envia apenas campos editáveis; remove explicitamente id, user_id, role, created_at, updated_at (evita 400 por RLS).
   * federation_points é convertido a número.
   */
  async updateProfile(id: string, updates: Partial<Player>) {
    if (updates.preferred_side != null) {
      const err = validatePreferredSide(updates.preferred_side);
      if (err) throw new Error(err);
    }

    const allowed = new Set<string>(ALLOWED_PLAYER_UPDATE_KEYS);
    const restricted = new Set<string>(RESTRICTED_KEYS);
    const payload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (restricted.has(key)) continue;
      if (!allowed.has(key) || value === undefined) continue;
      if (key === 'federation_points' || key === 'liga_points') {
        const n = typeof value === 'number' ? value : Number(value);
        payload[key] = Number.isFinite(n) ? Math.trunc(n) : 0;
      } else if (key === 'name' && (value === '' || (typeof value === 'string' && !value.trim()))) {
        payload[key] = 'Utilizador';
      } else {
        payload[key] = value;
      }
    }
    RESTRICTED_KEYS.forEach((k) => delete payload[k]);

    if (Object.keys(payload).length === 0) {
      return this.getById(id) as Promise<Player>;
    }

    const { data, error } = await supabase
      .from('players')
      .update(payload)
      .eq('id', id)
      .select('id, name, phone, preferred_side, federation_points, liga_points, is_active')
      .maybeSingle();

    if (error) {
      console.error('[PlayersService.updateProfile] Supabase error:', error.message, error.code, error.details);
      throw error;
    }
    if (data) return data as Player;
    return (await this.getById(id)) as Player;
  },

  /**
   * Criar ou actualizar perfil do utilizador.
   * Se já existir linha para user_id: UPDATE apenas campos seguros (NUNCA role).
   * Se não existir: INSERT com role jogador.
   */
  async upsertProfile(profile: {
    user_id: string;
    name: string;
    email: string;
    phone: string;
    federation_points: number;
    team_id?: string;
  }) {
    const DEFAULT_TEAM_ID = '00000000-0000-0000-0000-000000000001';

    const { data: existing } = await supabase
      .from('players')
      .select('id, role')
      .eq('user_id', profile.user_id)
      .maybeSingle();

    const existingRow = existing as { id?: string; role?: string } | null;
    if (existingRow?.id) {
      console.log('[PlayersService.upsertProfile] Linha já existe: user_id=%s, role atual=%s — NÃO escrever role.', profile.user_id, existingRow.role);
      const { data, error } = await supabase
        .from('players')
        .update({
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          federation_points: profile.federation_points,
          team_id: profile.team_id || DEFAULT_TEAM_ID,
          is_active: true,
        })
        .eq('id', existingRow.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    console.log('[PlayersService.upsertProfile] Novo perfil: user_id=%s, role=jogador (apenas em INSERT).', profile.user_id);
    const { data, error } = await supabase
      .from('players')
      .insert({
        user_id: profile.user_id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        federation_points: profile.federation_points,
        team_id: profile.team_id || DEFAULT_TEAM_ID,
        is_active: true,
        role: PlayerRoles.jogador,
      })
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar pontos de federação do jogador.
   * Envia APENAS federation_points (nunca id, email, created_at ou objeto player inteiro).
   */
  async updateFederationPoints(playerId: string, novoValor: number) {
    const payload = { federation_points: Number(novoValor) };
    console.log('[PlayersService] A gravar apenas:', payload);

    const { data, error } = await supabase
      .from('players')
      .update(payload)
      .eq('id', playerId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Desactivar jogador (apenas capitão)
   */
  async deactivate(id: string) {
    const { data, error } = await supabase
      .from('players')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Activar jogador (apenas capitão)
   */
  async activate(id: string) {
    const { data, error } = await supabase
      .from('players')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Atualizar role do jogador (apenas administradores)
   */
  async updateRole(id: string, role: PlayerRole) {
    const err = validateRole(role);
    if (err) throw new Error(err);

    const { data, error } = await supabase
      .from('players')
      .update({ role })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Criar coordenador (apenas administradores)
   */
  async createCoordinator(coordinator: {
    name: string;
    email: string;
    phone?: string;
  }) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: coordinator.email,
      email_confirm: true,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Failed to create user');

    const { data, error } = await supabase
      .from('players')
      .upsert(
        {
          user_id: authData.user.id,
          name: coordinator.name,
          email: coordinator.email,
          phone: coordinator.phone || null,
          is_active: true,
          role: PlayerRoles.jogador,
          federation_points: 0,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Remover jogador da equipa (soft delete - apenas administradores)
   * Mantém o histórico de jogos, apenas marca como inativo
   */
  async deletePlayer(id: string) {
    const { error } = await supabase
      .from('players')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },
};
