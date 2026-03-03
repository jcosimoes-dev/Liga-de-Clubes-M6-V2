import { supabase } from '../lib/supabase';
import type { Player } from '../lib/database.types';
import { PlayerRoles, validateRole, validatePreferredSide, type PlayerRole } from '../domain/constants';

export const PlayersService = {
  /**
   * Obter todos os jogadores
   */
  async getAll() {
    const { data, error } = await supabase
      .from('players')
      .select('*')
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
    let q = supabase.from('players').select('*');
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
   * Actualizar perfil do jogador
   */
  async updateProfile(id: string, updates: Partial<Player>) {
    if (updates.role != null) {
      const err = validateRole(updates.role);
      if (err) throw new Error(err);
    }
    if (updates.preferred_side != null) {
      const err = validatePreferredSide(updates.preferred_side);
      if (err) throw new Error(err);
    }

    const { data, error } = await supabase
      .from('players')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Criar ou actualizar perfil do utilizador (UPSERT)
   * Usado no ecrã "Complete o seu perfil"
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

    const { data, error } = await supabase
      .from('players')
      .upsert({
        user_id: profile.user_id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        federation_points: profile.federation_points,
        team_id: profile.team_id || DEFAULT_TEAM_ID,
        is_active: true,
        role: PlayerRoles.player,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar pontos de federação do jogador
   * (Pode ser feito pelo próprio jogador ou pelo capitão)
   */
  async updateFederationPoints(id: string, points: number) {
    const { data, error } = await supabase
      .from('players')
      .update({
        federation_points: points,
        points_updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

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
      .single();

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
      .single();

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
      .single();

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
          role: PlayerRoles.player,
          federation_points: 0,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

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
