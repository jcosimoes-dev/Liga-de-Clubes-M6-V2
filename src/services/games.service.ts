import { supabase } from '../lib/supabase';
import { closeGameStatusAdmin } from './adminAuth';
import type { Game, GameStatus } from '../lib/database.types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(s: string): boolean {
  return typeof s === 'string' && UUID_REGEX.test(s.trim());
}

export const GamesService = {
  /**
   * Obter todos os jogos (ordenados por data decrescente). Suporta game_date ou starts_at na BD.
   */
  async getAll() {
    const colsStartsAt = 'id, status, opponent, starts_at, location, phase, round_number';
    const colsGameDate = 'id, status, opponent, game_date, location, phase, round_number';
    let res = await supabase.from('games').select(colsStartsAt).order('starts_at', { ascending: false });
    if (res.error) {
      console.error('[GamesService.getAll] Supabase error:', res.error?.message, res.error);
      res = await supabase.from('games').select(colsGameDate).order('game_date', { ascending: false });
      if (res.error) throw res.error;
      return (res.data ?? []).map((g: Record<string, unknown>) => this._normalizeGame(g));
    }
    return (res.data ?? []).map((g: Record<string, unknown>) => this._normalizeGame(g));
  },

  /**
   * Normaliza um jogo da BD para expor sempre starts_at (a BD pode ter game_date ou starts_at).
   */
  _normalizeGame<T extends Record<string, unknown>>(g: T): T & { starts_at: string } {
    const dateVal = (g as { starts_at?: string; game_date?: string }).starts_at ?? (g as { game_date?: string }).game_date;
    return { ...g, starts_at: dateVal ?? '' } as T & { starts_at: string };
  },

  /**
   * Obter jogos com convocatória aberta (para Início e Gestão de Convocatórias).
   * Usa game_date ou starts_at conforme existir na BD. Log detalhado em caso de erro.
   */
  async getOpenGames(includePast = false) {
    const colsWithStartsAt = 'id, status, opponent, starts_at, location, phase, round_number';
    const colsWithGameDate = 'id, status, opponent, game_date, location, phase, round_number';

    let res = await supabase
      .from('games')
      .select(colsWithStartsAt)
      .order('starts_at', { ascending: true });
    let data: Array<Record<string, unknown>> | null = res.data as Array<Record<string, unknown>> | null;
    let error = res.error;

    if (error) {
      console.error('[GamesService.getOpenGames] Supabase error (tentativa starts_at):', {
        message: error.message,
        details: (error as { details?: string }).details,
        hint: (error as { hint?: string }).hint,
        code: (error as { code?: string }).code,
        fullError: error,
      });
      res = await supabase
        .from('games')
        .select(colsWithGameDate)
        .order('game_date', { ascending: true });
      data = res.data as Array<Record<string, unknown>> | null;
      error = res.error;
      if (error) {
        console.error('[GamesService.getOpenGames] Supabase error (fallback game_date):', {
          message: error.message,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
          code: (error as { code?: string }).code,
          fullError: error,
        });
        throw error;
      }
    }

    const openStatuses = ['convocatoria_aberta', 'open', 'agendado', 'scheduled'];
    const filtered = (data ?? []).filter((g) =>
      openStatuses.includes((g.status as string) ?? '')
    );
    const normalized = filtered.map((g) => this._normalizeGame(g));
    if (includePast) return normalized;
    const now = new Date();
    return normalized.filter((g) => new Date(g.starts_at) >= now);
  },

  /**
   * Obter jogos por estado (ordenados por data decrescente). Usa colunas mínimas.
   */
  async getByStatus(status: GameStatus) {
    const cols = 'id, status, opponent, starts_at, location, phase, round_number';
    const { data, error } = await supabase
      .from('games')
      .select(cols)
      .eq('status', status)
      .order('starts_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Obter jogo por ID com todas as relações.
   * Tenta select com embeds; em caso de 400 (sintaxe/filtros), faz fallback para select simples.
   */
  async getById(id: string) {
    if (!id || typeof id !== 'string' || !id.trim()) {
      console.warn('[GamesService.getById] id inválido:', id);
      return null;
    }
    const gamesCols = 'id, status, opponent, starts_at, location, phase, round_number';
    const resultsCols = 'game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora';
    const fullSelect = `${gamesCols}, availabilities(*, player:players(*)), pairs(*, player1:players!pairs_player1_id_fkey(*), player2:players!pairs_player2_id_fkey(*), results(${resultsCols}))`;
    const { data, error } = await supabase
      .from('games')
      .select(fullSelect)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      const { data: fallback, error: fallbackError } = await supabase
        .from('games')
        .select(gamesCols)
        .eq('id', id)
        .maybeSingle();
      if (fallbackError) throw error;
      return fallback;
    }
    return data;
  },

  /**
   * Criar novo jogo (apenas capitão/admin).
   * Valida que team_id existe em teams e created_by existe em players (FK) antes do insert.
   * Nota: As availabilities são criadas automaticamente pelo trigger.
   */
  async create(game: {
    round_number: number;
    game_date: string;
    opponent: string;
    location: string;
    phase: string;
    team_id: string | null;
    created_by: string;
  }) {
    const { game_date, team_id, created_by } = game;

    if (!isValidUuid(created_by)) {
      throw new Error('Criador inválido: created_by não é um UUID válido.');
    }
    if (team_id != null && !isValidUuid(team_id)) {
      throw new Error('Equipa inválida: team_id não é um UUID válido.');
    }

    const playerRes = await supabase.from('players').select('id').eq('id', created_by).maybeSingle();
    if (playerRes.error) throw playerRes.error;
    if (!playerRes.data) {
      throw new Error('Perfil de jogador não encontrado. Tenta fazer logout e login novamente.');
    }

    let validTeamId: string | undefined;
    if (team_id) {
      const teamRes = await supabase.from('teams').select('id').eq('id', team_id).maybeSingle();
      if (!teamRes.error && teamRes.data) validTeamId = team_id;
    }

    const isoDate = game_date ? new Date(game_date).toISOString() : new Date().toISOString();

    const { data: rpcData, error: rpcError } = await supabase.rpc('insert_game', {
      p_round_number: game.round_number,
      p_opponent: String(game.opponent),
      p_location: String(game.location),
      p_phase: game.phase,
      p_created_by: created_by,
      p_team_id: validTeamId ?? undefined,
      p_starts_at: isoDate,
    });

    if (rpcError) {
      console.error('[Games] Erro RPC insert_game:', rpcError);
      const err = rpcError as { code?: string; message?: string };
      if (err.code === '23505' || (err.message && /409|conflict|unique|duplicate|function.*does not exist/i.test(err.message))) {
        throw new Error(
          err.message?.includes('does not exist')
            ? 'Função insert_game não existe. Executa a migração 20260226220000_insert_game_rpc.sql no Supabase.'
            : 'Já existe um jogo com esta jornada/fase ou para esta data e hora. Escolhe outra data ou jornada.'
        );
      }
      throw rpcError;
    }

    const res = rpcData as { ok?: boolean; error?: string; data?: Record<string, unknown> } | null;
    if (res && res.ok === false && res.error) {
      throw new Error(res.error);
    }
    if (res && res.ok === true && res.data) {
      return res.data as Game & { id: string };
    }
    throw new Error('Resposta inválida ao criar jogo.');
  },

  /**
   * Atualizar data/hora e localização do jogo (apenas capitão/gestor).
   * Usado pelo modal Editar Jogo (adiamentos, mudança de recinto).
   */
  async updateGame(
    id: string,
    data: { starts_at?: string; location?: string }
  ) {
    return this.update(id, data);
  },

  /**
   * Actualizar jogo (apenas capitão)
   */
  async update(id: string, updates: Partial<Game>) {
    const cols = 'id, status, opponent, starts_at, location, phase, round_number';
    const { data, error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', id)
      .select(cols)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Abrir convocatória (apenas capitão)
   */
  async openCall(id: string) {
    return this.update(id, { status: 'convocatoria_aberta' });
  },

  /**
   * Fechar convocatória (apenas capitão/coordenador).
   * Status 'convocatoria_fechada' = jogo sai de Convocatórias Abertas. Usa admin primeiro; se falhar, tenta cliente normal.
   */
  async closeCall(id: string) {
    const status = 'convocatoria_fechada';
    const payload = { status };
    console.log('[GamesService] A fechar jogo ID:', id, '→ status:', status);

    try {
      await closeGameStatusAdmin(id, status);
    } catch (adminErr) {
      const msg = adminErr instanceof Error ? adminErr.message : String(adminErr);
      const code = (adminErr as { code?: string })?.code;
      console.warn('[GamesService] Admin falhou, a tentar cliente normal:', msg);
      const { error } = await supabase.from('games').update(payload).eq('id', id);
      if (error) {
        console.error('[GamesService] Update falhou:', error);
        throw new Error(`Status não mudou: ${error.message}${error.code ? ` [${error.code}]` : ''}`);
      }
    }
  },

  /**
   * Marcar jogo como concluído (apenas capitão/coordenador).
   * Usa supabaseAdmin para evitar RLS. Status 'final' ativa trigger de team_points e syncPlayerPoints.
   */
  async complete(id: string, options?: { no_show?: boolean }) {
    const extra = options?.no_show === true ? { no_show: true } : undefined;
    await closeGameStatusAdmin(id, 'final', extra);
  },

  /**
   * Cancelar jogo (apenas capitão)
   */
  async cancel(id: string) {
    return this.update(id, { status: 'closed' });
  },

  /**
   * Eliminar jogo (apenas capitão)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Exibe apenas o nome do adversário (remove "vs" e texto antes de " vs ").
   * Ex.: "Clube A vs Clube B" → "Clube B"; "vs Clube B" → "Clube B".
   */
  formatOpponentDisplay(opponent: string | null | undefined): string {
    if (opponent == null || typeof opponent !== 'string') return '—';
    const t = opponent.trim();
    const vs = ' vs ';
    const i = t.indexOf(vs);
    if (i !== -1) return t.slice(i + vs.length).trim() || t;
    if (t.toLowerCase().startsWith('vs ')) return t.slice(3).trim();
    return t;
  },

  /**
   * Formatar o nome da jornada baseado no round_number
   */
  formatRoundName(roundNumber: number, phase?: string | null): string {
    if (roundNumber === 0) return 'Treino';
    if (roundNumber === 999) return 'Torneios';
    const eliminatoria: Record<number, string> = { 16: '1/16', 8: '1/8', 4: '1/4', 2: '1/2', 1: 'Final' };
    if (eliminatoria[roundNumber]) return eliminatoria[roundNumber];
    return `Jornada ${roundNumber}`;
  },

  /**
   * Gerar texto para partilhar no WhatsApp
   */
  formatForWhatsApp(game: Game, includeDetails = true) {
    const date = new Date(game.starts_at);
    const dateStr = date.toLocaleDateString('pt-PT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = date.toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const roundName = this.formatRoundName(game.round_number);
    let message = `🎾 *Equipa M6 APC TRABLISA - ${roundName}*\n\n`;
    message += `📅 ${dateStr}\n`;
    message += `⏰ ${timeStr}\n`;
    message += `🏟️ ${game.location}\n`;
    message += `🆚 ${game.opponent}\n`;

    if (includeDetails) {
      message += `📊 Fase: ${game.phase}\n`;
    }

    return message;
  },
};
