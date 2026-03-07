import { supabase } from '../lib/supabase';
import { upsertResultAdmin } from './adminAuth';

export const ResultsService = {
  /**
   * Obter resultados de um jogo. Apenas colunas: game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora.
   */
  async getByGame(gameId: string) {
    if (!gameId || typeof gameId !== 'string' || !gameId.trim()) {
      console.warn('[ResultsService.getByGame] gameId inválido:', gameId);
      return [];
    }
    const cols = 'game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora';
    const { data, error } = await supabase
      .from('results')
      .select(cols)
      .eq('game_id', gameId);

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Obter resultado de uma dupla específica
   */
  async getByPair(pairId: string) {
    const cols = 'game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora';
    const { data, error } = await supabase
      .from('results')
      .select(cols)
      .eq('pair_id', pairId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Criar novo resultado (apenas capitão)
   * Colunas da tabela: game_id, pair_id, created_by, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora.
   * game_id e created_by são obrigatórios (NOT NULL).
   */
  async create(result: {
    game_id: string;
    pair_id: string;
    created_by: string;
    set1_casa?: number | null;
    set1_fora?: number | null;
    set2_casa?: number | null;
    set2_fora?: number | null;
    set3_casa?: number | null;
    set3_fora?: number | null;
  }) {
    const toNum = (v: number | string | null | undefined): number | null => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) && Number.isInteger(n) ? n : null;
    };
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const gameId = String(result.game_id ?? '').trim();
    const pairId = String(result.pair_id ?? '').trim();
    const createdBy = String(result.created_by ?? '').trim();
    if (!gameId || !uuidRe.test(gameId)) {
      throw new Error('game_id inválido: deve ser um UUID do jogo');
    }
    if (!pairId || !uuidRe.test(pairId)) {
      throw new Error('pair_id inválido: deve ser um UUID válido');
    }
    if (!createdBy || !uuidRe.test(createdBy)) {
      throw new Error('created_by inválido: deve ser o user.id do utilizador autenticado');
    }
    const s1c = toNum(result.set1_casa);
    const s1f = toNum(result.set1_fora);
    const s2c = toNum(result.set2_casa);
    const s2f = toNum(result.set2_fora);
    if (s1c == null || s1f == null || s2c == null || s2f == null) {
      throw new Error('Set 1 e Set 2 são obrigatórios (valores inteiros)');
    }
    const payload: Record<string, number | string> = {
      game_id: gameId,
      pair_id: pairId,
      created_by: createdBy,
      set1_casa: s1c,
      set1_fora: s1f,
      set2_casa: s2c,
      set2_fora: s2f,
    };
    const s3c = result.set3_casa != null && result.set3_casa !== '' ? toNum(result.set3_casa) : null;
    const s3f = result.set3_fora != null && result.set3_fora !== '' ? toNum(result.set3_fora) : null;
    if (s3c != null && s3f != null) {
      payload.set3_casa = s3c;
      payload.set3_fora = s3f;
    }
    const dadosParaEnviar = { ...payload };
    console.log('Dados para insert:', JSON.stringify(dadosParaEnviar, null, 2));
    console.log('Enviando para Supabase (results create):', payload);
    const { error } = await supabase
      .from('results')
      .insert(payload);

    if (error) {
      console.error('[ResultsService.create] Erro Supabase detalhado:', {
        code: (error as { code?: string }).code,
        message: (error as { message?: string }).message,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
        fullError: error,
      });
      throw error;
    }
  },

  /**
   * Upsert resultado. Apenas: game_id, pair_id, created_by, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora.
   */
  async upsertResult(result: {
    game_id: string;
    pair_id: string;
    created_by: string;
    set1_casa?: number | string | null;
    set1_fora?: number | string | null;
    set2_casa?: number | string | null;
    set2_fora?: number | string | null;
    set3_casa?: number | string | null;
    set3_fora?: number | string | null;
  }) {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const gameId = String(result.game_id ?? '').trim();
    const pairId = String(result.pair_id ?? '').trim();
    const createdBy = String(result.created_by ?? '').trim();
    if (!gameId || !uuidRe.test(gameId)) {
      throw new Error('game_id inválido');
    }
    if (!pairId || !uuidRe.test(pairId)) {
      throw new Error('pair_id inválido');
    }
    if (!createdBy || !uuidRe.test(createdBy)) {
      throw new Error('created_by inválido');
    }
    const toInt = (v: number | string | null | undefined): number | null => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) && Number.isInteger(n) ? n : null;
    };
    const s1c = toInt(result.set1_casa);
    const s1f = toInt(result.set1_fora);
    const s2c = toInt(result.set2_casa);
    const s2f = toInt(result.set2_fora);
    if (s1c == null || s1f == null || s2c == null || s2f == null) {
      throw new Error('Set 1 e Set 2 são obrigatórios (valores inteiros)');
    }
    const payload: Record<string, string | number> = {
      game_id: gameId,
      pair_id: pairId,
      created_by: createdBy,
      set1_casa: Number(s1c),
      set1_fora: Number(s1f),
      set2_casa: Number(s2c),
      set2_fora: Number(s2f),
    };
    const s3c = toInt(result.set3_casa);
    const s3f = toInt(result.set3_fora);
    if (s3c != null && s3f != null) {
      payload.set3_casa = Number(s3c);
      payload.set3_fora = Number(s3f);
    }
    console.log('Enviando para Supabase (results upsert), onConflict: game_id,pair_id:', payload);
    try {
      await upsertResultAdmin({
        game_id: gameId,
        pair_id: pairId,
        created_by: createdBy,
        set1_casa: Number(s1c),
        set1_fora: Number(s1f),
        set2_casa: Number(s2c),
        set2_fora: Number(s2f),
        ...(s3c != null && s3f != null ? { set3_casa: Number(s3c), set3_fora: Number(s3f) } : {}),
      });
    } catch (err) {
      console.error('[ResultsService.upsertResult] Erro Supabase detalhado:', {
        code: (err as { code?: string })?.code,
        message: (err as { message?: string })?.message,
        details: (err as { details?: string })?.details,
        hint: (err as { hint?: string })?.hint,
        fullError: err,
      });
      throw err;
    }
  },

  /**
   * Actualizar resultado (apenas capitão)
   * Colunas: set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora.
   * Converte valores com Number() para evitar erro 400.
   */
  async update(
    id: string,
    updates: {
      set1_casa?: number | null;
      set1_fora?: number | null;
      set2_casa?: number | null;
      set2_fora?: number | null;
      set3_casa?: number | null;
      set3_fora?: number | null;
    }
  ) {
    const toNum = (v: number | string | null | undefined): number | null => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) && Number.isInteger(n) ? n : null;
    };
    const payload: Record<string, number | null | string | undefined> = {};
    if (updates.set1_casa !== undefined) payload.set1_casa = toNum(updates.set1_casa);
    if (updates.set1_fora !== undefined) payload.set1_fora = toNum(updates.set1_fora);
    if (updates.set2_casa !== undefined) payload.set2_casa = toNum(updates.set2_casa);
    if (updates.set2_fora !== undefined) payload.set2_fora = toNum(updates.set2_fora);
    if (updates.set3_casa !== undefined) payload.set3_casa = toNum(updates.set3_casa);
    if (updates.set3_fora !== undefined) payload.set3_fora = toNum(updates.set3_fora);
    console.log('Enviando para Supabase (results update):', payload);
    const { data, error } = await supabase
      .from('results')
      .update(payload)
      .eq('id', id)
      .select('game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Eliminar resultado
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('results')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Calcular resumo a partir de set1_casa/fora, set2, set3.
   */
  async getGameSummary(gameId: string) {
    const { data, error } = await supabase
      .from('results')
      .select('set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora')
      .eq('game_id', gameId);

    if (error) throw error;

    let totalSetsWon = 0;
    let totalSetsLost = 0;
    (data ?? []).forEach((r: Record<string, number | null>) => {
      if (r.set1_casa != null && r.set1_fora != null) {
        if (Number(r.set1_casa) > Number(r.set1_fora)) totalSetsWon += 1;
        else totalSetsLost += 1;
      }
      if (r.set2_casa != null && r.set2_fora != null) {
        if (Number(r.set2_casa) > Number(r.set2_fora)) totalSetsWon += 1;
        else totalSetsLost += 1;
      }
      if (r.set3_casa != null && r.set3_fora != null) {
        if (Number(r.set3_casa) > Number(r.set3_fora)) totalSetsWon += 1;
        else totalSetsLost += 1;
      }
    });

    return {
      totalSetsWon,
      totalSetsLost,
      pairsWithResults: (data ?? []).length,
      outcome: totalSetsWon > totalSetsLost ? 'Vitória' : 'Derrota',
    };
  },

  /**
   * Upsert por game_id,pair_id com campos set1_casa, set1_fora, etc.
   */
  async upsert(result: {
    game_id: string;
    pair_id: string;
    set1_casa?: number;
    set1_fora?: number;
    set2_casa?: number;
    set2_fora?: number;
    set3_casa?: number;
    set3_fora?: number;
    created_by?: string;
  }) {
    const payload = {
      game_id: result.game_id,
      pair_id: result.pair_id,
      ...(result.created_by && { created_by: result.created_by }),
      ...(result.set1_casa != null && { set1_casa: Number(result.set1_casa) }),
      ...(result.set1_fora != null && { set1_fora: Number(result.set1_fora) }),
      ...(result.set2_casa != null && { set2_casa: Number(result.set2_casa) }),
      ...(result.set2_fora != null && { set2_fora: Number(result.set2_fora) }),
      ...(result.set3_casa != null && { set3_casa: Number(result.set3_casa) }),
      ...(result.set3_fora != null && { set3_fora: Number(result.set3_fora) }),
    };
    const { error } = await supabase
      .from('results')
      .upsert(payload, { onConflict: 'game_id,pair_id' });

    if (error) throw error;
  },

  /**
   * Criar múltiplos resultados (apenas colunas game_id, pair_id, created_by, set1_casa, set1_fora, etc.)
   */
  async createMultiple(results: Array<{
    game_id: string;
    pair_id: string;
    created_by?: string;
    set1_casa: number;
    set1_fora: number;
    set2_casa: number;
    set2_fora: number;
    set3_casa?: number;
    set3_fora?: number;
  }>) {
    const rows = results.map((r) => ({
      game_id: r.game_id,
      pair_id: r.pair_id,
      ...(r.created_by && { created_by: r.created_by }),
      set1_casa: Number(r.set1_casa),
      set1_fora: Number(r.set1_fora),
      set2_casa: Number(r.set2_casa),
      set2_fora: Number(r.set2_fora),
      ...(r.set3_casa != null && { set3_casa: Number(r.set3_casa) }),
      ...(r.set3_fora != null && { set3_fora: Number(r.set3_fora) }),
    }));
    const { error } = await supabase
      .from('results')
      .insert(rows);

    if (error) throw error;
  },
};
