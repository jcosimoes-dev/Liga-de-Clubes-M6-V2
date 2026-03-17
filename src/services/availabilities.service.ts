import { supabase } from '../lib/supabase';
import type { AvailabilityStatus } from '../lib/database.types';
import { filterOutGestor } from '../lib/gestorFilter';

export const AvailabilitiesService = {
  /**
   * Obter todas as disponibilidades
   * Usa select('*') sem join a players para evitar 403 por RLS na tabela players
   */
  async getAll() {
    const { data, error } = await supabase
      .from('availabilities')
      .select('*')
      .order('status');

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Obter todas as disponibilidades de um jogo
   * Evita join player:players(*) para prevenir 400 (usa 2 queries separadas)
   */
  async getByGame(gameId: string) {
    const { data: avails, error: availError } = await supabase
      .from('availabilities')
      .select('*')
      .eq('game_id', gameId)
      .order('status');

    if (availError) throw availError;
    const playerIds = (avails ?? []).map((a) => a.player_id).filter(Boolean);
    if (playerIds.length === 0) return avails ?? [];

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .in('id', playerIds);

    if (playersError) throw playersError;
    const allowed = filterOutGestor(players ?? []);
    const playerMap = new Map(allowed.map((p) => [p.id, p]));
    return (avails ?? []).map((a) => ({
      ...a,
      player: a.player_id ? playerMap.get(a.player_id) ?? null : null,
    })).filter((a) => a.player != null);
  },

  /**
   * Obter disponibilidade de um jogador num jogo específico
   */
  async getByGameAndPlayer(gameId: string, playerId: string) {
    const { data, error } = await supabase
      .from('availabilities')
      .select('*')
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Criar uma nova disponibilidade
   */
  async create(availability: { game_id: string; player_id: string; status: AvailabilityStatus }) {
    const payload = {
      game_id: availability.game_id,
      player_id: availability.player_id,
      status: availability.status,
    };
    const { data, error } = await supabase
      .from('availabilities')
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Mapeia status para o enum availability_status da BD.
   * Valores do enum: confirmed, declined, undecided (não usar "confirm" — causa 22P02).
   */
  _mapStatusToDb(status: string): string {
    const s = String(status ?? '').toLowerCase();
    const map: Record<string, string> = {
      confirmed: 'confirmed',
      confirm: 'confirmed', // typo fallback
      confirmo: 'confirmed',
      declined: 'declined',
      nao_posso: 'declined',
      undecided: 'undecided',
      talvez: 'undecided',
      sem_resposta: 'undecided',
      no_response: 'undecided', // enum availability_status: confirmed, declined, undecided
    };
    return map[s] ?? 'undecided';
  },

  /** Valida UUID v4 (players.id, games.id) */
  _isValidUuid(s: string | null | undefined): boolean {
    if (typeof s !== 'string' || !s.trim()) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(s.trim());
  },

  /**
   * Upsert disponibilidade: cria ou atualiza por game_id + player_id.
   * player_id deve ser o UUID da tabela players (não user_id/auth).
   * onConflict deve coincidir com o índice único da BD: player_id, game_id.
   */
  async upsert(availability: { game_id: string; player_id: string; status: string }) {
    const game_id = String(availability.game_id ?? '').trim();
    const player_id = String(availability.player_id ?? '').trim();
    const status = this._mapStatusToDb(availability.status ?? '');

    if (!game_id || !player_id) {
      console.error('[AvailabilitiesService.upsert] game_id ou player_id em falta:', {
        game_id: game_id || '(vazio)',
        player_id: player_id || '(vazio)',
      });
      throw new Error('game_id e player_id são obrigatórios');
    }
    if (!this._isValidUuid(game_id) || !this._isValidUuid(player_id)) {
      console.error('[AvailabilitiesService.upsert] game_id ou player_id não é UUID válido:', {
        game_id,
        player_id,
      });
      throw new Error('game_id e player_id devem ser UUIDs válidos');
    }

    const payload = { game_id, player_id, status };
    console.log('[AvailabilitiesService.upsert] Payload antes do upsert:', payload);

    // Fallback: select → update ou insert (contorna onConflict quando o índice único não corresponde)
    const { data: existing } = await supabase
      .from('availabilities')
      .select('id')
      .eq('game_id', game_id)
      .eq('player_id', player_id)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase
        .from('availabilities')
        .update({ status })
        .eq('id', existing.id)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from('availabilities')
      .insert(payload)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar disponibilidade (genérico).
   * Inclui game_id quando fornecido para garantir ligação ao jogo.
   */
  async update(
    id: string,
    updates: Partial<{ status: AvailabilityStatus; game_id?: string }>
  ) {
    const payload = { ...updates };
    console.log('Payload Disponibilidade [update]:', { id, ...payload });
    const { data, error } = await supabase
      .from('availabilities')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar estado da disponibilidade
   * (Jogador actualiza a sua própria disponibilidade)
   */
  async updateStatus(id: string, status: AvailabilityStatus) {
    const { data, error } = await supabase
      .from('availabilities')
      .update({ status })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar disponibilidade por jogo e jogador
   */
  async updateByGameAndPlayer(
    gameId: string,
    playerId: string,
    status: AvailabilityStatus
  ) {
    const { data, error } = await supabase
      .from('availabilities')
      .update({ status })
      .eq('game_id', gameId)
      .eq('player_id', playerId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Obter resumo de disponibilidades de um jogo
   */
  async getSummary(gameId: string) {
    const { data, error } = await supabase
      .from('availabilities')
      .select('status')
      .eq('game_id', gameId);

    if (error) throw error;

    const summary: Record<string, number> = {
      confirmed: 0,
      declined: 0,
      undecided: 0,
      sem_resposta: 0,
      confirmo: 0,
      nao_posso: 0,
      talvez: 0,
      total: data.length,
    };

    (data as Array<{ status: string }>).forEach((availability) => {
      const key = availability.status || 'sem_resposta';
      summary[key] = (summary[key] ?? 0) + 1;
    });

    return summary;
  },

  /**
   * Obter jogadores que confirmaram presença
   * Enum availability_status: confirmed, declined, undecided
   */
  async getConfirmedPlayers(gameId: string) {
    const { data: avails, error: availError } = await supabase
      .from('availabilities')
      .select('player_id')
      .eq('game_id', gameId)
      .eq('status', 'confirmed');

    if (availError) throw availError;
    const playerIds = (avails ?? []).map((a) => a.player_id).filter(Boolean);
    if (playerIds.length === 0) return [];

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .in('id', playerIds);

    if (playersError) throw playersError;
    return filterOutGestor(players ?? []);
  },

  /**
   * Obter jogadores disponíveis (confirmaram ou talvez)
   * Enum: confirmed = disponível, undecided = indeciso
   */
  async getAvailablePlayers(gameId: string) {
    const { data: avails, error: availError } = await supabase
      .from('availabilities')
      .select('player_id')
      .eq('game_id', gameId)
      .in('status', ['confirmed', 'undecided']);

    if (availError) throw availError;
    const playerIds = (avails ?? []).map((a) => a.player_id).filter(Boolean);
    if (playerIds.length === 0) return [];

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .in('id', playerIds);

    if (playersError) throw playersError;
    return filterOutGestor(players ?? []);
  },
};
