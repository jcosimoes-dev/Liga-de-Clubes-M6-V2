import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { GESTOR_HIDE_EMAIL } from '../lib/gestorFilter';
import { getCategoryFromPhase } from '../domain/categoryTheme';
import { computeLigaPointsForEliminatoriaGame, roundLigaPointsTotal } from '../domain/ligaPointsEliminatoria';
import { updatePlayerLigaPoints } from './adminAuth';
import { PlayerRoles } from '../domain/constants';

export { OFFICIAL_M6_TEAM_ID } from '../domain/teamConstants';

/** Opções do recálculo automático de `liga_points`. */
export interface SyncPlayerPointsOptions {
  /** Só jogos com este `round_number` (jornada). Se omitido, contam todas as jornadas finalizadas da Liga. */
  roundNumber?: number;
}

/**
 * Serviço de pontuação. `federation_points` é manual; `liga_points` vem do recálculo
 * por jogo de eliminatória (regras em `domain/ligaPointsEliminatoria.ts`).
 */

/** Status que consideram o jogo final. Incluir 'concluido'/'completed' se a BD ainda não tiver 'final'. */
/** Inclui `closed` por compatibilidade com estados antigos na BD. */
const STATUS_FINAL_VALUES = ['final', 'concluido', 'completed', 'closed'] as const;

/** Statuses para o card Performance da Equipa (jogos que contam para V-D-F). */
const STATUS_TEAM_PERFORMANCE = ['final', 'concluido', 'completed', 'convocatoria_fechada'] as const;

const LOG_PREFIX = '[Points]';

/** Diagnóstico Performance / Gestão Técnica — filtra a consola por esta string. */
const DIAG = '[DashboardDiag]';

function isDeadOrEmptyTeamId(teamId: string | null | undefined): boolean {
  return teamId == null || typeof teamId !== 'string' || teamId.trim() === '';
}

/**
 * Resolve o UUID da equipa para o dashboard: apenas o `team_id` do perfil do utilizador.
 * Não inferir a partir de jogos/jogadores aleatórios nem de constantes — isso misturava dados de teste / outras equipas.
 */
export async function resolveDashboardTeamId(preferredTeamId?: string | null): Promise<string | undefined> {
  const p = typeof preferredTeamId === 'string' ? preferredTeamId.trim() : '';
  if (p) return p;
  return undefined;
}

type PlayerRowForDashboard = {
  id: string;
  name: string | null;
  email?: string | null;
  liga_points?: number | string | null;
  federation_points?: number | string | null;
  is_active?: boolean | null;
  role?: string | null;
};

/** Exclui administradores de contagem desportiva; ranking/época = só jogadores ativos na equipa. */
function isEligibleSportRosterMember(p: { is_active?: boolean | null; role?: string | null }): boolean {
  if (p.is_active !== true) return false;
  const r = (p.role ?? '').trim().toLowerCase();
  if (r === PlayerRoles.admin) return false;
  return true;
}

/**
 * Jogadores da equipa para o dashboard: tenta **pares primeiro** (jogadores reais nos jogos),
 * depois `team_id` como fallback (caso não haja jogos/pares ainda).
 * Ao usar pares primeiro evita-se que jogadores de teste com `team_id` correto apareçam
 * antes dos jogadores reais que estão nos pares mas têm outro `team_id` no perfil.
 */
async function fetchPlayersByTeamOrPairs(
  teamId: string,
  gameIdsForPairFallback: string[],
  columns: 'season' | 'ranking',
): Promise<PlayerRowForDashboard[]> {
  const selectCols =
    columns === 'season'
      ? 'id, name, liga_points, is_active, role'
      : 'id, name, email, federation_points, liga_points, is_active, role';

  // 1. Tentar jogadores via pares (prioridade: jogadores reais que jogaram os jogos)
  let gameIds = gameIdsForPairFallback;
  if (!gameIds.length) {
    const { data: gRows } = await supabase.from('games').select('id').eq('team_id', teamId);
    gameIds = (gRows ?? []).map((g) => g.id);
  }
  if (gameIds.length > 0) {
    const { data: pairs, error: e2 } = await supabase
      .from('pairs')
      .select('player1_id, player2_id')
      .in('game_id', gameIds);
    if (!e2) {
      const ids = new Set<string>();
      for (const row of pairs ?? []) {
        if (row.player1_id) ids.add(row.player1_id);
        if (row.player2_id) ids.add(row.player2_id);
      }
      if (ids.size > 0) {
        const { data: byPairs, error: e3 } = await supabase
          .from('players')
          .select(selectCols)
          .in('id', [...ids])
          .neq('email', GESTOR_HIDE_EMAIL);
        if (!e3) {
          const pairsList = ((byPairs ?? []) as PlayerRowForDashboard[]).filter(isEligibleSportRosterMember);
          if (pairsList.length > 0) return pairsList;
        }
      }
    }
  }

  // 2. Fallback: jogadores com team_id = equipa (sem jogos criados ainda)
  const { data: byTeam, error: e1 } = await supabase
    .from('players')
    .select(selectCols)
    .eq('team_id', teamId)
    .eq('is_active', true)
    .neq('email', GESTOR_HIDE_EMAIL);
  if (e1) {
    console.error(`${LOG_PREFIX} fetchPlayersByTeamOrPairs (team_id):`, e1);
    return [];
  }
  return ((byTeam ?? []) as PlayerRowForDashboard[]).filter(isEligibleSportRosterMember);
}

/** Result row from DB (sets per pair) */
interface ResultRow {
  pair_id: string;
  set1_casa: number | null;
  set1_fora: number | null;
  set2_casa: number | null;
  set2_fora: number | null;
  set3_casa: number | null;
  set3_fora: number | null;
}

/**
 * Considera um set válido para contagem (não 0-0).
 * Sets 0-0 são ignorados: não contam como ganhos nem perdidos.
 */
function isEmptySet(casa: number | null, fora: number | null): boolean {
  return casa === 0 && fora === 0;
}

/**
 * Conta sets ganhos e perdidos de um resultado. Ignora sets 0-0.
 * Derrota só conta quando o adversário (fora) é estritamente maior que casa.
 */
function countSetsWonLost(r: ResultRow): { setsWon: number; setsLost: number } {
  let setsWon = 0;
  let setsLost = 0;
  const count = (casa: number | null, fora: number | null) => {
    if (casa == null || fora == null) return;
    if (isEmptySet(casa, fora)) return;
    const c = Number(casa);
    const f = Number(fora);
    if (c > f) setsWon += 1;
    else if (f > c) setsLost += 1;
  };
  count(r.set1_casa, r.set1_fora);
  count(r.set2_casa, r.set2_fora);
  count(r.set3_casa, r.set3_fora);
  return { setsWon, setsLost };
}

/**
 * Determina se a dupla ganhou com base no número de SETS ganhos (melhor de 3).
 * Sets 0-0 são ignorados. Só conta como set perdido quando fora > casa.
 * Vitória = 2+ sets ganhos, Derrota = 1 ou 0 sets ganhos.
 */
function isPairWin(r: ResultRow): boolean {
  const { setsWon, setsLost } = countSetsWonLost(r);
  return setsWon > setsLost;
}

/**
 * Calcula se a equipa ganhou o jogo com base nos resultados (maioria de sets ganhos por dupla).
 * Ignora sets 0-0; só conta set perdido quando fora > casa.
 */
function teamWonFromResults(rows: ResultRow[]): boolean {
  let setsWon = 0;
  let setsLost = 0;
  for (const r of rows) {
    const { setsWon: w, setsLost: l } = countSetsWonLost(r);
    setsWon += w;
    setsLost += l;
  }
  return setsWon > setsLost;
}

type GameForLigaPoints = {
  id: string;
  team_id?: string | null;
  team_points?: number | null;
  no_show?: boolean | null;
};

type PairRow = { id: string; game_id: string; player1_id: string; player2_id: string };

/**
 * Resultado da equipa no jogo: vitória (3 pts equipa na BD ou maioria de sets) ou derrota.
 * `null` = não atribuir pontos (ex.: falta, sem dados).
 */
function resolveTeamOutcomeFromGame(
  game: GameForLigaPoints,
  resultRows: ResultRow[],
): 'win' | 'loss' | null {
  if (game.no_show) return null;
  const tp = game.team_points;
  if (tp === 3) return 'win';
  if (tp === 1) return 'loss';
  if (resultRows.length > 0) return teamWonFromResults(resultRows) ? 'win' : 'loss';
  return null;
}

/**
 * Soma `liga_points` por jogador: por cada jogo da Liga, aplica `computeLigaPointsForEliminatoriaGame`.
 */
function accumulateEliminatoriaLigaPointsByPlayer(
  games: GameForLigaPoints[],
  pairs: PairRow[],
  resultByPair: Map<string, ResultRow>,
  teamRosters: Map<string, string[]>,
): Map<string, number> {
  const pairsByGame = new Map<string, PairRow[]>();
  for (const p of pairs) {
    const arr = pairsByGame.get(p.game_id) ?? [];
    arr.push(p);
    pairsByGame.set(p.game_id, arr);
  }

  const totals = new Map<string, number>();

  for (const game of games) {
    const tid = game.team_id?.trim();
    if (!tid) continue;

    const pairsFor = pairsByGame.get(game.id) ?? [];
    const resultRows: ResultRow[] = [];
    for (const pr of pairsFor) {
      const r = resultByPair.get(pr.id);
      if (r) resultRows.push(r);
    }

    const outcome = resolveTeamOutcomeFromGame(game, resultRows);
    if (outcome === null) continue;

    const teamWon = outcome === 'win';

    const inAnyPair = new Set<string>();
    const pairScored = new Map<string, { won: boolean }>();
    for (const pr of pairsFor) {
      if (pr.player1_id) inAnyPair.add(pr.player1_id);
      if (pr.player2_id) inAnyPair.add(pr.player2_id);
      const res = resultByPair.get(pr.id);
      if (!res) continue;
      const won = isPairWin(res);
      if (pr.player1_id) pairScored.set(pr.player1_id, { won });
      if (pr.player2_id) pairScored.set(pr.player2_id, { won });
    }

    const roster = teamRosters.get(tid);
    if (!roster?.length) continue;

    for (const pid of roster) {
      let pts: number;
      if (pairScored.has(pid)) {
        pts = computeLigaPointsForEliminatoriaGame({
          teamWonElimination: teamWon,
          playedWithScoredPair: true,
          pairWonIndividual: pairScored.get(pid)!.won,
        });
      } else if (inAnyPair.has(pid)) {
        pts = 0;
      } else {
        pts = computeLigaPointsForEliminatoriaGame({
          teamWonElimination: teamWon,
          playedWithScoredPair: false,
          pairWonIndividual: null,
        });
      }
      totals.set(pid, (totals.get(pid) ?? 0) + pts);
    }
  }

  return totals;
}

/**
 * Recalcula `liga_points` com um cliente Supabase (ex.: service role em script Node).
 * `federation_points` nunca é alterado. O total no perfil = `liga_points` + `federation_points`.
 */
export async function syncPlayerPointsWithClient(
  client: SupabaseClient,
  teamId?: string,
  options?: SyncPlayerPointsOptions,
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  const roundNumber = options?.roundNumber;

  const persist = async (playerId: string, totalRounded: number) => {
    const { error } = await client.from('players').update({ liga_points: totalRounded }).eq('id', playerId).select().maybeSingle();
    if (error) throw error;
  };

  return runSyncPlayerPointsCore(client, teamId, roundNumber, persist, errors);
}

/**
 * Recalcula `liga_points` a partir de jogos finalizados da Liga de Clubes (fases Qualificação / Regionais / Nacionais).
 * Regras por jogo: ver `computeLigaPointsForEliminatoriaGame`.
 * Usa o cliente anónimo da app para leituras e service role para gravar (`updatePlayerLigaPoints`).
 */
export async function syncPlayerPoints(
  teamId?: string,
  options?: SyncPlayerPointsOptions,
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  const roundNumber = options?.roundNumber;
  const persist = async (playerId: string, totalRounded: number) => {
    await updatePlayerLigaPoints(playerId, totalRounded);
  };
  return runSyncPlayerPointsCore(supabase, teamId, roundNumber, persist, errors);
}

async function runSyncPlayerPointsCore(
  client: SupabaseClient,
  teamId: string | undefined,
  roundNumber: number | undefined,
  persistLigaPoints: (playerId: string, totalRounded: number) => Promise<void>,
  errors: string[],
): Promise<{ updated: number; errors: string[] }> {
  try {
    let query = client
      .from('games')
      .select('id, team_id, status, phase, round_number, team_points, no_show')
      .in('status', [...STATUS_FINAL_VALUES]);
    if (teamId) {
      query = query.eq('team_id', teamId);
    }
    const { data: gamesRaw, error: gamesError } = await query;

    if (gamesError) {
      console.error(`${LOG_PREFIX} Erro ao carregar jogos:`, gamesError);
      errors.push(`Erro ao carregar jogos: ${gamesError.message}`);
      return { updated: 0, errors };
    }

    let games = (gamesRaw ?? []).filter((g) => getCategoryFromPhase((g as { phase?: string | null }).phase) === 'Liga');

    if (roundNumber != null) {
      games = games.filter((g) => Number((g as { round_number?: unknown }).round_number) === roundNumber);
      console.log(`${LOG_PREFIX} Filtro jornada round_number=${roundNumber}: ${games.length} jogo(s) Liga (após filtro).`);
    }

    console.log(
      `${LOG_PREFIX} Jogos finalizados (totais BD / só Liga após filtros):`,
      gamesRaw?.length ?? 0,
      '/',
      games.length,
      games.map((g) => ({
        id: g.id,
        status: (g as { status?: string }).status,
        phase: (g as { phase?: string }).phase,
        round_number: (g as { round_number?: number }).round_number,
      })),
    );

    if (!games.length) {
      console.log(`${LOG_PREFIX} Nenhum jogo final da Liga de Clubes (com os filtros aplicados). Pontos automáticos não alterados.`);
      return { updated: 0, errors };
    }

    const gameIds = games.map((g) => g.id);
    const gameTeamIds = new Set(games.map((g) => g.team_id).filter(Boolean));

    const { data: pairs, error: pairsError } = await client.from('pairs').select('id, game_id, player1_id, player2_id').in('game_id', gameIds);

    if (pairsError) {
      console.error(`${LOG_PREFIX} Erro ao carregar pairs:`, pairsError);
      errors.push(`Erro ao carregar duplas: ${pairsError.message}`);
      return { updated: 0, errors };
    }

    console.log(`${LOG_PREFIX} Duplas encontradas:`, pairs?.length ?? 0, pairs ?? []);

    const { data: results, error: resultsError } = await client
      .from('results')
      .select('game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora')
      .in('game_id', gameIds);

    if (resultsError) {
      console.error(`${LOG_PREFIX} Erro ao carregar results:`, resultsError);
      errors.push(`Erro ao carregar resultados: ${resultsError.message}`);
      return { updated: 0, errors };
    }

    const resultByPair = new Map<string, ResultRow>();
    for (const r of results ?? []) {
      resultByPair.set((r as { pair_id: string }).pair_id, r as ResultRow);
    }
    console.log(
      `${LOG_PREFIX} Resultados por pair_id:`,
      resultByPair.size,
      Array.from(resultByPair.entries()).map(([pid, r]) => ({ pair_id: pid, win: isPairWin(r) })),
    );

    const teamRosters = new Map<string, string[]>();
    for (const tid of gameTeamIds) {
      if (!tid) continue;
      const { data: teamPlayers } = await client.from('players').select('id').eq('team_id', tid);
      teamRosters.set(tid, (teamPlayers ?? []).map((p) => p.id));
    }

    const playerPoints = accumulateEliminatoriaLigaPointsByPlayer(
      games as GameForLigaPoints[],
      (pairs ?? []) as PairRow[],
      resultByPair,
      teamRosters,
    );
    console.log(`${LOG_PREFIX} Totais brutos (eliminatória):`, Object.fromEntries(playerPoints));

    if (teamId) {
      const { data: teamPlayers } = await client.from('players').select('id').eq('team_id', teamId);
      for (const p of teamPlayers ?? []) {
        if (!playerPoints.has(p.id)) {
          playerPoints.set(p.id, 0);
          console.log(`${LOG_PREFIX} Jogador ${p.id} (equipa): sem linha de recálculo → 0 pontos`);
        }
      }
    } else {
      for (const tid of gameTeamIds) {
        if (!tid) continue;
        const { data: teamPlayers } = await client.from('players').select('id').eq('team_id', tid);
        for (const p of teamPlayers ?? []) {
          if (!playerPoints.has(p.id)) {
            playerPoints.set(p.id, 0);
          }
        }
      }
    }

    console.log(`${LOG_PREFIX} Totais por jogador:`, Object.fromEntries(playerPoints));

    const toErrorMsg = (e: unknown): string => {
      if (e instanceof Error) return e.message;
      if (typeof e === 'object' && e != null && 'message' in e) return String((e as { message?: string }).message);
      if (typeof e === 'object' && e != null && 'error_description' in e) return String((e as { error_description?: string }).error_description);
      return String(e);
    };

    let updated = 0;
    const devLog = typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV;
    for (const [playerId, total] of playerPoints) {
      try {
        await persistLigaPoints(playerId, roundLigaPointsTotal(total));
        updated++;
      } catch (e) {
        const msg = toErrorMsg(e);
        if (devLog) console.error(`${LOG_PREFIX} PATCH falhou para ${playerId}:`, e);
        errors.push(`Jogador ${playerId}: ${msg}`);
      }
    }

    return { updated, errors };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);
    return { updated: 0, errors };
  }
}

/** Estatísticas da equipa na Liga Oficial (Vitória 3 pts, Derrota 1 pt, Falta 0 pts). */
export interface TeamPerformanceStats {
  wins: number;
  losses: number;
  noShows: number;
  totalPoints: number;
  record: string;
}

export interface PlayerRankingRow {
  player_id: string;
  name: string;
  wins: number;
  losses: number;
  /** Pontos Liga M6 (eliminatória: regras em `ligaPointsEliminatoria`). */
  pontos_liga: number;
  /** Pontos Federação: valor da coluna federation_points na tabela players. */
  federation_points: number;
  /** Pontos Totais: Pontos Liga + Pontos Federação. */
  total_points: number;
}

/**
 * Estatísticas da equipa na Liga Oficial M6.
 * Percorre games (team_id = M6): Vitória = 3 pts, Derrota = 1 pt, Falta = 0 pts.
 * Total = (Vitórias * 3) + (Derrotas * 1). Se team_points estiver null, calcula vitória/derrota a partir dos results (maioria de sets).
 */
const EMPTY_TEAM_STATS: TeamPerformanceStats = { wins: 0, losses: 0, noShows: 0, totalPoints: 0, record: '0-0-0' };

export async function getTeamPerformanceStats(teamId: string): Promise<TeamPerformanceStats> {
  if (isDeadOrEmptyTeamId(teamId)) return EMPTY_TEAM_STATS;
  try {
  const { data: games, error } = await supabase
    .from('games')
    .select('id, status, team_points, no_show')
    .eq('team_id', teamId)
    .in('status', [...STATUS_TEAM_PERFORMANCE]);

  console.log(DIAG, 'getTeamPerformanceStats: resposta Supabase (games)', {
    teamId,
    rowCount: games?.length ?? 0,
    error: error ?? null,
    sample: (games ?? []).slice(0, 2),
    teamPointsTypesSample: (games ?? []).slice(0, 2).map((g) => typeof (g as { team_points?: unknown }).team_points),
  });

  if (error) {
    console.error(`${LOG_PREFIX} getTeamPerformanceStats erro:`, error);
    return EMPTY_TEAM_STATS;
  }
  if (!games) {
    console.log(`${LOG_PREFIX} getTeamPerformanceStats sem dados (null)`);
    return EMPTY_TEAM_STATS;
  }

  const list = games;
  if (list.length === 0) {
    return EMPTY_TEAM_STATS;
  }

  const gameIdsNeedingResults = list
    .filter((g) => {
      const ns = !!(g as { no_show?: boolean }).no_show;
      if (ns) return false;
      const pts = (g as { team_points?: number | null }).team_points;
      return typeof pts !== 'number' || pts === 0;
    })
    .map((g) => (g as { id: string }).id);

  let resultsByGame: Map<string, ResultRow[]> = new Map();
  if (gameIdsNeedingResults.length > 0) {
    const { data: results, error: resError } = await supabase
      .from('results')
      .select('game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora')
      .in('game_id', gameIdsNeedingResults);
    if (!resError && results?.length) {
      for (const r of results) {
        const gid = (r as { game_id: string }).game_id;
        const arr = resultsByGame.get(gid) ?? [];
        arr.push(r as ResultRow);
        resultsByGame.set(gid, arr);
      }
    }
  }

  let wins = 0;
  let losses = 0;
  let noShows = 0;

  for (const g of list) {
    const ns = !!(g as { no_show?: boolean }).no_show;
    const pts = (g as { team_points?: number | null }).team_points;
    const gid = (g as { id: string }).id;

    if (ns) {
      noShows += 1;
      continue;
    }
    if (typeof pts === 'number' && pts === 3) {
      wins += 1;
      continue;
    }
    if (typeof pts === 'number' && pts === 1) {
      losses += 1;
      continue;
    }
    const resultRows = resultsByGame.get(gid);
    if (resultRows?.length) {
      if (teamWonFromResults(resultRows)) {
        wins += 1;
      } else {
        losses += 1;
      }
    }
  }

  const totalPoints = wins * 3 + losses * 1;

  console.log(`${LOG_PREFIX} getTeamPerformanceStats teamId=${teamId} jogos=${list.length} V=${wins} D=${losses} F=${noShows} pts=${totalPoints}`);

  return {
    wins,
    losses,
    noShows,
    totalPoints,
    record: `${wins}-${losses}-${noShows}`,
  };
  } catch (e) {
    console.error(`${LOG_PREFIX} getTeamPerformanceStats exceção:`, e);
    return EMPTY_TEAM_STATS;
  }
}

export interface GetPlayerRankingOptions {
  /** Filtro por categoria: Liga = pontos só de jogos Liga; Treino = 0 pts; Geral = tudo. */
  category?: SeasonStatsCategory;
}

/**
 * Ranking da equipa. Sem category (ou Geral): liga_points/federation_points da BD e wins/losses de todos os jogos.
 * Com category 'Liga': pontos calculados apenas de jogos com phase in [Qualificação, Regionais, Nacionais].
 * Com category 'Treino': lista todos os jogadores da equipa com pontos a 0 (Liga/Fed escondidos nesta vista).
 */
export async function getPlayerRanking(teamId: string, options?: GetPlayerRankingOptions): Promise<PlayerRankingRow[]> {
  if (isDeadOrEmptyTeamId(teamId)) return [];
  const category = options?.category || 'Geral';
  try {
  const { data: gidRows } = await supabase.from('games').select('id').eq('team_id', teamId);
  const pairFallbackGameIds = (gidRows ?? []).map((r) => r.id);

  const { data: gamesRaw, error: gamesError } = await supabase
    .from('games')
    .select('id, team_id, status, phase, team_points, no_show')
    .in('status', [...STATUS_FINAL_VALUES])
    .eq('team_id', teamId);

  if (gamesError) {
    const code = (gamesError as { code?: string }).code;
    if (code !== 'PGRST116' && code !== '404') console.error(`${LOG_PREFIX} getPlayerRanking erro jogos:`, gamesError);
    return [];
  }
  const gamesRawList = Array.isArray(gamesRaw) ? gamesRaw : [];

  console.log(DIAG, 'getPlayerRanking: resposta Supabase (games status final)', {
    teamId,
    category,
    rowCount: gamesRawList.length,
    error: gamesError ?? null,
    statusFilter: [...STATUS_FINAL_VALUES],
    sample: gamesRawList.slice(0, 2),
  });

  const games =
    !category || category === 'Geral'
      ? gamesRawList
      : gamesRawList.filter((g) => gameMatchesCategory((g as { phase?: string }).phase, category));

  console.log(DIAG, 'getPlayerRanking: após filtro de categoria (Liga/Treino/Geral)', {
    category,
    count: games.length,
  });

  /** Sem jogos finalizados (ou sem fase no filtro): plantel com pontos da BD; evita ranking vazio só com convocatórias abertas. */
  if (!games?.length && category !== 'Treino') {
    if (category === 'Liga') {
      const roster = await fetchPlayersByTeamOrPairs(teamId, pairFallbackGameIds, 'ranking');
      const list = roster.map((p) => ({
        player_id: p.id,
        name: p.name ?? '—',
        wins: 0,
        losses: 0,
        pontos_liga: 0,
        federation_points: 0,
        total_points: 0,
      }));
      return list.sort((a, b) => (b.name ?? '').localeCompare(a.name ?? ''));
    }
    if (category === 'Geral') {
      const players = await fetchPlayersByTeamOrPairs(teamId, pairFallbackGameIds, 'ranking');
      const readNum = (raw: number | string | null | undefined): number => {
        if (raw == null || raw === '') return 0;
        const n = Number(raw);
        return Number.isFinite(n) && n >= 0 ? n : 0;
      };
      const gestorEmailNorm = GESTOR_HIDE_EMAIL.trim().toLowerCase();
      const list = players
        .filter((p) => ((p as { email?: string }).email ?? '').trim().toLowerCase() !== gestorEmailNorm)
        .map((p) => {
          const liga = readNum((p as { liga_points?: number | string | null }).liga_points);
          const fed = readNum((p as { federation_points?: number | string | null }).federation_points);
          return {
            player_id: p.id,
            name: p.name ?? '—',
            wins: 0,
            losses: 0,
            pontos_liga: liga,
            federation_points: fed,
            total_points: liga + fed,
          };
        });
      return list.sort((a, b) => b.total_points - a.total_points);
    }
    return [];
  }

  if (category === 'Treino') {
    const players = await fetchPlayersByTeamOrPairs(teamId, pairFallbackGameIds, 'ranking');
    const list = players.map((p) => ({
      player_id: p.id,
      name: p.name ?? '—',
      wins: 0,
      losses: 0,
      pontos_liga: 0,
      federation_points: 0,
      total_points: 0,
    }));
    return list.sort((a, b) => (b.name ?? '').localeCompare(a.name ?? ''));
  }

  const gameIds = games.map((g) => g.id);

  const { data: pairs, error: pairsError } = await supabase
    .from('pairs')
    .select('id, game_id, player1_id, player2_id')
    .in('game_id', gameIds);

  if (pairsError) {
    // silenciar 404 / sem dados
  }
  const pairsList = pairs ?? [];

  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select('game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora')
    .in('game_id', gameIds);

  if (resultsError) {
    console.error(`${LOG_PREFIX} getPlayerRanking erro results:`, resultsError);
  }

  const resultByPair = new Map<string, ResultRow>();
  for (const r of results ?? []) {
    resultByPair.set((r as { pair_id: string }).pair_id, r as ResultRow);
  }

  const playerStats = new Map<string, { wins: number; losses: number }>();
  for (const pair of pairsList) {
    const res = resultByPair.get(pair.id);
    if (!res) continue;
    const won = isPairWin(res);
    for (const pid of [pair.player1_id, pair.player2_id].filter(Boolean)) {
      if (!pid) continue;
      const cur = playerStats.get(pid) ?? { wins: 0, losses: 0 };
      playerStats.set(pid, {
        wins: cur.wins + (won ? 1 : 0),
        losses: cur.losses + (won ? 0 : 1),
      });
    }
  }

  // Usar sempre os jogadores encontrados via pares (jogadores reais que jogaram os jogos da categoria).
  // Não usar .eq('team_id') aqui — isso devolve jogadores de teste que têm o team_id certo no perfil
  // mas nunca jogaram, enquanto os jogadores reais podem ter outro team_id no perfil.
  const ids = [...playerStats.keys()];
  if (ids.length === 0) return [];

  const eliminatoriaTotals =
    category === 'Liga'
      ? accumulateEliminatoriaLigaPointsByPlayer(
          games as GameForLigaPoints[],
          pairsList as PairRow[],
          resultByPair,
          new Map([[teamId, ids]]),
        )
      : null;

  const { data: playersRaw } = await supabase
    .from('players')
    .select('id, name, email, federation_points, liga_points, is_active, role')
    .in('id', ids);
  const players = (playersRaw ?? []).filter((row) =>
    isEligibleSportRosterMember(row as { is_active?: boolean | null; role?: string | null }),
  );
  const eligibleIdSet = new Set(players.map((p) => p.id));
  const idsRanked = ids.filter((id) => eligibleIdSet.has(id));

  if (players?.[0]) {
    const lp0 = (players[0] as { liga_points?: unknown }).liga_points;
    console.log(DIAG, 'getPlayerRanking: tipo liga_points (1.º jogador, vindo da BD)', typeof lp0, lp0);
  }
  console.log(DIAG, 'getPlayerRanking: resposta Supabase (players .in id)', { count: players?.length ?? 0, idsRequested: ids.length });

  const readNum = (raw: number | string | null | undefined): number => {
    if (raw == null || raw === '') return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const nameMap = new Map((players ?? []).map((p) => [p.id, p.name ?? '—']));
  const gestorEmailNorm = GESTOR_HIDE_EMAIL.trim().toLowerCase();
  const isGestor = (id: string) => ((players ?? []).find((p) => p.id === id) as { email?: string } | undefined)?.email?.trim().toLowerCase() === gestorEmailNorm;

  const useComputedLigaPoints = category === 'Liga';
  const ligaPointsMap = useComputedLigaPoints
    ? new Map<string, number>()
    : new Map((players ?? []).map((p) => [p.id, readNum((p as { liga_points?: number | string | null }).liga_points)]));
  const fedPointsMap = new Map((players ?? []).map((p) => [p.id, readNum((p as { federation_points?: number | string | null }).federation_points)]));

  if (useComputedLigaPoints && eliminatoriaTotals) {
    for (const id of idsRanked) {
      ligaPointsMap.set(id, roundLigaPointsTotal(eliminatoriaTotals.get(id) ?? 0));
    }
  }

  const out = idsRanked
    .filter((id) => !isGestor(id))
    .map((id) => {
      const s = playerStats.get(id) ?? { wins: 0, losses: 0 };
      const ligaPoints = ligaPointsMap.get(id) ?? 0;
      const federationPoints = category === 'Treino' ? 0 : (fedPointsMap.get(id) ?? 0);
      const totalPoints = ligaPoints + federationPoints;
      return {
        player_id: id,
        name: nameMap.get(id) ?? '—',
        wins: s.wins,
        losses: s.losses,
        pontos_liga: ligaPoints,
        federation_points: federationPoints,
        total_points: totalPoints,
      };
    })
    .sort((a, b) => b.total_points - a.total_points);

  console.log(DIAG, 'getPlayerRanking: resultado final (linhas devolvidas ao ecrã)', { count: out.length, category });
  return out;
  } catch (e) {
    const err = e as { status?: number; code?: string };
    if (err?.status !== 404 && err?.code !== '404' && err?.code !== 'PGRST116') {
      console.error(`${LOG_PREFIX} getPlayerRanking exceção:`, e);
    }
    console.log(DIAG, 'getPlayerRanking: exceção — []', e);
    return [];
  }
}

/** Status considerado "check verde" para disponibilidade */
const AVAILABILITY_CONFIRMED = 'confirmed';

export interface SeasonStatRow {
  player_id: string;
  name: string;
  disponibilidade: number;
  convocatorias: number;
  /** Taxa de Escolha = Convocatórias / Disponibilidade (ex: 1/4 = 25%). */
  taxa_escolha: number;
  /** Pontos Liga M6 (eliminatória) — coluna liga_points. */
  pontos_liga: number;
  wins: number;
  losses: number;
  /** Eficácia = vitórias / jogos realizados (Win Rate %). */
  eficacia: number;
  highlight_rodar: boolean;
  /** % Disponibilidade = checks / jogos no período (quando filtro de datas aplicado). */
  disp_pct?: number;
}

/** Filtro de categoria para ranking/disp: Geral = todos, Liga = Qualificação|Regionais|Nacionais, Treino = Treino */
export type SeasonStatsCategory = 'Geral' | 'Liga' | 'Treino';

const LIGA_PHASES = ['Qualificação', 'Regionais', 'Nacionais'];

function gameMatchesCategory(phase: string | null | undefined, category: SeasonStatsCategory | undefined): boolean {
  if (!category || category === 'Geral') return true;
  const p = (phase ?? '').trim();
  if (category === 'Liga') return LIGA_PHASES.includes(p);
  if (category === 'Treino') return p === 'Treino';
  return true;
}

export interface GetSeasonStatsOptions {
  startDate?: Date;
  endDate?: Date;
  /** Filtro por categoria: Liga, Treino ou Geral (todos). */
  category?: SeasonStatsCategory;
}

export interface GetSeasonStatsResult {
  rows: SeasonStatRow[];
  totalGamesInPeriod: number;
}

/** Obtém game_date ou starts_at de um jogo (a BD pode ter uma ou outra coluna). */
function getGameDate(g: { game_date?: string; starts_at?: string }): Date | null {
  const raw = g.game_date ?? g.starts_at;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Verifica se uma data está no intervalo [startDate, endDate] (inclusive). */
function isInDateRange(gameDate: Date | null, startDate?: Date, endDate?: Date): boolean {
  if (!gameDate) return false;
  if (startDate && gameDate < startDate) return false;
  if (endDate && gameDate > endDate) return false;
  return true;
}

/**
 * Estatísticas de época para o Coordenador:
 * - Disponibilidade: checks verdes (availabilities confirmed).
 * - Convocatórias: jogos 'final' em que o jogador está numa dupla.
 * - Taxa de Escolha: Convocatórias / Disponibilidade (ex: 1/4 = 25%).
 * - Pontos Liga M6: liga_points (recálculo / BD). Vitórias/Derrotas e Eficácia a partir de results.
 * - Com options.startDate/endDate, filtra por game_date no lado do cliente.
 */
export async function getSeasonStats(
  teamId: string,
  options?: GetSeasonStatsOptions
): Promise<GetSeasonStatsResult> {
  if (isDeadOrEmptyTeamId(teamId)) return { rows: [], totalGamesInPeriod: 0 };

  const { startDate, endDate, category: optCategory } = options ?? {};
  const category = optCategory || 'Geral';
  try {
  const { data: allTeamGames, error: gamesAllError } = await supabase
    .from('games')
    .select('id, game_date, starts_at, phase')
    .eq('team_id', teamId);

  console.log(DIAG, 'getSeasonStats: resposta Supabase (games, sem filtros cliente)', {
    teamId,
    category,
    dateWindow: { startDate: startDate?.toISOString?.() ?? startDate, endDate: endDate?.toISOString?.() ?? endDate },
    rowCount: allTeamGames?.length ?? 0,
    error: gamesAllError ?? null,
    sample: (allTeamGames ?? []).slice(0, 2),
  });

  if (gamesAllError) {
    console.log(DIAG, 'getSeasonStats: abort — erro na query games', gamesAllError);
    return { rows: [], totalGamesInPeriod: 0 };
  }

  /** Sem jogos na equipa: ainda mostrar plantel (disp/conv a zeros) para não parecer "sem equipa". */
  if (!allTeamGames?.length) {
    const playersOnly = await fetchPlayersByTeamOrPairs(teamId, [], 'season');
    const readLigaOnly = (row: { liga_points?: number | string | null }): number => {
      const raw = row.liga_points;
      if (raw == null || raw === '') return 0;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };
    const rows: SeasonStatRow[] = playersOnly.map((pl) => ({
      player_id: pl.id,
      name: pl.name ?? '—',
      disponibilidade: 0,
      convocatorias: 0,
      taxa_escolha: 0,
      pontos_liga: readLigaOnly(pl as { liga_points?: number | string | null }),
      wins: 0,
      losses: 0,
      eficacia: 0,
      highlight_rodar: false,
      disp_pct: 0,
    }));
    const outEarly = {
      rows: rows.sort((a, b) => b.disponibilidade - a.disponibilidade),
      totalGamesInPeriod: 0,
    };
    console.log(DIAG, 'getSeasonStats: ramo sem jogos na equipa — resultado final', {
      rows: outEarly.rows.length,
      totalGamesInPeriod: outEarly.totalGamesInPeriod,
    });
    return outEarly;
  }

  const gamesWithDate = allTeamGames
    .filter((g) => gameMatchesCategory((g as { phase?: string }).phase, category))
    .map((g) => ({
      id: g.id,
      date: getGameDate(g as { game_date?: string; starts_at?: string }),
    }));

  const nullParsedDates = gamesWithDate.filter((g) => g.date == null).length;
  console.log(DIAG, 'getSeasonStats: antes filtro de datas (época / último mês)', {
    category,
    afterCategoryFilter: gamesWithDate.length,
    gamesWithNoUsableDate: nullParsedDates,
    dateWindow: { startDate: startDate?.toISOString?.() ?? startDate, endDate: endDate?.toISOString?.() ?? endDate },
    nota: 'Jogos sem game_date/starts_at válidos são excluídos do intervalo (isInDateRange falha com date null).',
  });

  const allGameIdsFiltered = gamesWithDate
    .filter((g) => isInDateRange(g.date, startDate, endDate))
    .map((g) => g.id);

  const totalGamesInPeriod = allGameIdsFiltered.length;

  console.log(DIAG, 'getSeasonStats: após filtro de datas', {
    allGameIdsFilteredCount: allGameIdsFiltered.length,
    totalGamesInPeriod,
  });

  const { data: finalGamesRaw, error: finalError } = await supabase
    .from('games')
    .select('id, game_date, starts_at, phase')
    .eq('team_id', teamId)
    .in('status', [...STATUS_FINAL_VALUES]);

  const finalGamesWithDate = (finalGamesRaw ?? [])
    .filter((g) => gameMatchesCategory((g as { phase?: string }).phase, category))
    .map((g) => ({
      id: g.id,
      date: getGameDate(g as { game_date?: string; starts_at?: string }),
    }));

  const finalGameIdsFiltered = new Set(
    finalGamesWithDate
      .filter((g) => isInDateRange(g.date, startDate, endDate))
      .map((g) => g.id)
  );

  const allGameIds = gamesWithDate.map((g) => g.id);
  const finalGameIds = finalGamesWithDate.map((g) => g.id);

  const [availsRes, pairsFinalRes, resultsFinalRes] = await Promise.all([
    allGameIds.length
      ? supabase
          .from('availabilities')
          .select('game_id, player_id')
          .in('game_id', allGameIds)
          .eq('status', AVAILABILITY_CONFIRMED)
      : Promise.resolve({ data: [] as { game_id: string; player_id: string }[], error: null }),
    finalGameIds.length
      ? supabase
          .from('pairs')
          .select('id, game_id, player1_id, player2_id')
          .in('game_id', finalGameIds)
      : Promise.resolve({ data: [] as { id: string; game_id: string; player1_id: string; player2_id: string }[], error: null }),
    finalGameIds.length
      ? supabase
          .from('results')
          .select('game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora')
          .in('game_id', finalGameIds)
      : Promise.resolve({ data: [] as ResultRow[], error: null }),
  ]);

  if (availsRes.error) {
    console.error(`${LOG_PREFIX} getSeasonStats availabilities:`, availsRes.error);
  }
  const avails = availsRes.error ? [] : (availsRes.data ?? []);
  const allTeamGameIds = (allTeamGames ?? []).map((g) => (g as { id: string }).id);
  let players = await fetchPlayersByTeamOrPairs(teamId, allTeamGameIds, 'season');
  if (players[0]) {
    const lp = (players[0] as { liga_points?: unknown }).liga_points;
    console.log(DIAG, 'getSeasonStats: tipo de liga_points (1.º jogador, vindo da BD)', typeof lp, lp);
  }

  const pairsFinal = (pairsFinalRes as { data?: { id: string; game_id: string; player1_id: string; player2_id: string }[] }).data ?? [];
  const resultsFinal = (resultsFinalRes as { data?: ResultRow[] }).data ?? [];

  const allGameIdsFilteredSet = new Set(allGameIdsFiltered);

  const disponibilidadeByPlayer = new Map<string, number>();
  for (const a of avails) {
    if (!allGameIdsFilteredSet.has(a.game_id)) continue;
    if (a.player_id) {
      disponibilidadeByPlayer.set(a.player_id, (disponibilidadeByPlayer.get(a.player_id) ?? 0) + 1);
    }
  }

  const convocatoriasByPlayer = new Map<string, Set<string>>();
  for (const p of pairsFinal) {
    if (!finalGameIdsFiltered.has(p.game_id)) continue;
    const gid = p.game_id;
    for (const pid of [p.player1_id, p.player2_id].filter(Boolean)) {
      if (pid) {
        let set = convocatoriasByPlayer.get(pid);
        if (!set) {
          set = new Set();
          convocatoriasByPlayer.set(pid, set);
        }
        set.add(gid);
      }
    }
  }

  const resultByPair = new Map<string, ResultRow>();
  for (const r of resultsFinal ?? []) {
    resultByPair.set((r as { pair_id: string }).pair_id, r as ResultRow);
  }

  const winsByPlayer = new Map<string, number>();
  const lossesByPlayer = new Map<string, number>();
  for (const p of pairsFinal) {
    if (!finalGameIdsFiltered.has(p.game_id)) continue;
    const res = resultByPair.get(p.id);
    if (!res) continue;
    const won = isPairWin(res);
    for (const pid of [p.player1_id, p.player2_id].filter(Boolean)) {
      if (!pid) continue;
      winsByPlayer.set(pid, (winsByPlayer.get(pid) ?? 0) + (won ? 1 : 0));
      lossesByPlayer.set(pid, (lossesByPlayer.get(pid) ?? 0) + (won ? 0 : 1));
    }
  }

  const readLigaPoints = (row: { liga_points?: number | string | null }): number => {
    const raw = row.liga_points;
    if (raw == null || raw === '') return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  console.log(DIAG, 'getSeasonStats: contagens pós-queries auxiliares', {
    avails: avails.length,
    pairsFinal: pairsFinal.length,
    resultsFinal: resultsFinal.length,
    playersForRows: players.length,
  });

  const rows: SeasonStatRow[] = players.map((pl) => {
    const disp = disponibilidadeByPlayer.get(pl.id) ?? 0;
    const convSet = convocatoriasByPlayer.get(pl.id);
    const conv = convSet ? convSet.size : 0;
    const taxa = disp > 0 ? Math.round((conv / disp) * 100) : 0;
    const wins = winsByPlayer.get(pl.id) ?? 0;
    const losses = lossesByPlayer.get(pl.id) ?? 0;
    const jogos = wins + losses;
    const eficacia = jogos > 0 ? Math.round((wins / jogos) * 100) : 0;
    const highlight_rodar = disp >= 2 && (disp > conv || taxa < 50);
    // % Disp. = (Presenças confirmadas / Total jogos equipa) * 100, máx. 100%, 0% se total = 0
    const rawPct = totalGamesInPeriod > 0 ? (disp / totalGamesInPeriod) * 100 : 0;
    const disp_pct = totalGamesInPeriod > 0 ? Math.min(100, Math.round(rawPct)) : 0;
    return {
      player_id: pl.id,
      name: pl.name ?? '—',
      disponibilidade: disp,
      convocatorias: conv,
      taxa_escolha: taxa,
      pontos_liga: readLigaPoints(pl as { liga_points?: number | string | null }),
      wins,
      losses,
      eficacia,
      highlight_rodar,
      disp_pct,
    };
  });

  const sorted = rows.sort((a, b) => b.disponibilidade - a.disponibilidade);
  console.log(DIAG, 'getSeasonStats: resultado final (objeto devolvido ao ecrã)', {
    rows: sorted.length,
    totalGamesInPeriod,
  });
  return {
    rows: sorted,
    totalGamesInPeriod,
  };
  } catch (e) {
    const err = e as { status?: number; code?: string };
    if (err?.status !== 404 && err?.code !== '404' && err?.code !== 'PGRST116') {
      console.error(`${LOG_PREFIX} getSeasonStats exceção:`, e);
    }
    console.log(DIAG, 'getSeasonStats: exceção — devolvendo vazio', e);
    return { rows: [], totalGamesInPeriod: 0 };
  }
}

/**
 * Zera apenas liga_points (nunca federation_points). Útil antes de recalcular.
 */
export async function resetAllPlayerPoints(teamId?: string): Promise<{ updated: number; error?: string }> {
  console.log(`${LOG_PREFIX} resetAllPlayerPoints (liga_points apenas). teamId:`, teamId ?? 'todas');

  let q = supabase.from('players').select('id');
  if (teamId) {
    q = q.eq('team_id', teamId);
  }
  const { data: players, error: listError } = await q;

  if (listError) {
    console.error(`${LOG_PREFIX} resetAllPlayerPoints erro ao listar:`, listError);
    return { updated: 0, error: listError.message };
  }

  const ids = (players ?? []).map((p) => p.id);
  if (ids.length === 0) {
    console.log(`${LOG_PREFIX} resetAllPlayerPoints: nenhum jogador encontrado.`);
    return { updated: 0 };
  }

  let updated = 0;
  for (const id of ids) {
    try {
      await updatePlayerLigaPoints(id, 0);
      updated++;
    } catch (e) {
      console.error(`${LOG_PREFIX} resetAllPlayerPoints falha em ${id}:`, e);
      return { updated, error: e instanceof Error ? e.message : String(e) };
    }
  }

  console.log(`${LOG_PREFIX} resetAllPlayerPoints fim. Zerados: ${updated} jogadores.`);
  return { updated };
}
