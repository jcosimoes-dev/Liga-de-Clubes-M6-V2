import { supabase } from '../lib/supabase';

export const PairsService = {
  /**
   * Obter todas as duplas de um jogo
   */
  async getByGame(gameId: string) {
    if (!gameId || typeof gameId !== 'string' || !gameId.trim()) {
      console.warn('[PairsService.getByGame] gameId inválido:', gameId);
      return [];
    }
    const payload = { table: 'pairs', game_id: gameId };
    console.log('Enviando para Supabase:', payload);
    const { data, error } = await supabase
      .from('pairs')
      .select(`
        *,
        player1:players!pairs_player1_id_fkey(*),
        player2:players!pairs_player2_id_fkey(*)
      `)
      .eq('game_id', gameId)
      .order('pair_order');

    if (error) throw error;
    return data;
  },

  /**
   * Obter dupla por ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('pairs')
      .select(`
        *,
        player1:players!pairs_player1_id_fkey(*),
        player2:players!pairs_player2_id_fkey(*),
        game:games(*)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Criar nova dupla (apenas capitão)
   * Nota: total_points e pair_order são calculados automaticamente pelos triggers
   */
  async create(pair: {
    game_id: string;
    player1_id: string;
    player2_id: string;
  }) {
    const { data, error } = await supabase
      .from('pairs')
      .insert({
        ...pair,
        pair_order: 999, // Temporário, será recalculado pelo trigger
      })
      .select(`
        *,
        player1:players!pairs_player1_id_fkey(*),
        player2:players!pairs_player2_id_fkey(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar dupla (apenas capitão)
   * Nota: total_points e pair_order são recalculados automaticamente
   */
  async update(
    id: string,
    updates: {
      player1_id?: string;
      player2_id?: string;
    }
  ) {
    const { data, error } = await supabase
      .from('pairs')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        player1:players!pairs_player1_id_fkey(*),
        player2:players!pairs_player2_id_fkey(*)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Eliminar dupla (apenas capitão)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('pairs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Eliminar todas as duplas de um jogo (apenas capitão)
   */
  async deleteByGame(gameId: string) {
    const { error } = await supabase
      .from('pairs')
      .delete()
      .eq('game_id', gameId);

    if (error) throw error;
  },

  /**
   * Criar múltiplas duplas de uma vez. Grava primeiro sem select pesado para evitar
   * reentrada RLS (stack depth). O trigger recalcula pair_order.
   */
  async createMultiple(pairs: Array<{
    game_id: string;
    player1_id: string;
    player2_id: string;
  }>) {
    const pairsWithOrder = pairs.map((pair) => ({
      ...pair,
      pair_order: 999, // Temporário, será recalculado pelo trigger
    }));

    const { error } = await supabase.from('pairs').insert(pairsWithOrder);

    if (error) throw error;
    return pairsWithOrder;
  },

  /**
   * Obter sugestões de duplas baseadas nos pontos de federação
   * (Optimiza as duplas para equilibrar a força das equipas)
   */
  async suggestPairs(gameId: string) {
    // Obter jogadores confirmados
    const { data: availabilities, error: availError } = await supabase
      .from('availabilities')
      .select(`
        player:players(*)
      `)
      .eq('game_id', gameId)
      .eq('status', 'confirmo');

    if (availError) throw availError;

    const players = availabilities
      .map((a: any) => a.player)
      .filter((p: any) => p !== null)
      .sort((a: any, b: any) => b.federation_points - a.federation_points);

    // Algoritmo simples: emparelhar jogador mais forte com mais fraco
    const suggestions = [];
    const used = new Set();

    for (let i = 0; i < players.length / 2; i++) {
      const strongPlayer = players[i];
      const weakPlayer = players[players.length - 1 - i];

      if (!used.has(strongPlayer.id) && !used.has(weakPlayer.id)) {
        suggestions.push({
          player1: strongPlayer,
          player2: weakPlayer,
          total_points: strongPlayer.federation_points + weakPlayer.federation_points,
        });
        used.add(strongPlayer.id);
        used.add(weakPlayer.id);
      }
    }

    // Ordenar por total de pontos (decrescente)
    return suggestions.sort((a, b) => b.total_points - a.total_points);
  },
};
