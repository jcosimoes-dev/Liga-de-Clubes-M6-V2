import { supabase } from '../lib/supabase';
import { GESTOR_HIDE_EMAIL } from '../lib/gestorFilter';
import { updatePlayerLigaPoints } from './adminAuth';

/**
 * Serviço de pontuação. A coluna de pontos na tabela players é federation_points.
 * Recálculo: +10 por vitória da dupla, +3 por derrota (jogos com status 'final').
 */

/** Pontos por vitória da dupla (sets casa > sets fora) */
export const POINTS_WIN = 10;
/** Pontos por derrota da dupla (sets casa <= sets fora) */
export const POINTS_LOSS = 3;

/** Status que consideram o jogo final. Incluir 'concluido'/'completed' se a BD ainda não tiver 'final'. */
const STATUS_FINAL_VALUES = ['final', 'concluido', 'completed'] as const;

/** Statuses para o card Performance da Equipa (jogos que contam para V-D-F). */
const STATUS_TEAM_PERFORMANCE = ['final', 'concluido', 'completed', 'convocatoria_fechada'] as const;

/** ID oficial da equipa M6 para garantir o filtro no card de Performance. */
export const OFFICIAL_M6_TEAM_ID = '75782791-729c-4863-95c5-927690656a81';

const LOG_PREFIX = '[Points]';

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
 * Determina se a dupla ganhou com base no número de SETS ganhos (melhor de 3).
 * Cada set: casa > fora → +1 set ganho; casa < fora → +1 set perdido.
 * Vitória = 2 sets ganhos (ou mais), Derrota = 1 ou 0 sets ganhos.
 * Vitória = +10 pts, Derrota = +3 pts.
 */
function isPairWin(r: ResultRow): boolean {
  let setsWon = 0;
  let setsLost = 0;
  if (r.set1_casa != null && r.set1_fora != null) {
    if (Number(r.set1_casa) > Number(r.set1_fora)) setsWon += 1;
    else setsLost += 1;
  }
  if (r.set2_casa != null && r.set2_fora != null) {
    if (Number(r.set2_casa) > Number(r.set2_fora)) setsWon += 1;
    else setsLost += 1;
  }
  if (r.set3_casa != null && r.set3_fora != null) {
    if (Number(r.set3_casa) > Number(r.set3_fora)) setsWon += 1;
    else setsLost += 1;
  }
  return setsWon > setsLost;
}

/**
 * Calcula pontos por jogador a partir de jogos 'final': para cada jogo, pega nas 3 duplas (pairs),
 * lê o resultado de cada dupla (results), atribui +10 a quem ganhou e +3 a quem perdeu.
 * Não usa availabilities — só quem está escalado nas duplas recebe pontos.
 */
export async function syncPlayerPoints(teamId?: string): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];

  console.log(`${LOG_PREFIX} syncPlayerPoints início. teamId:`, teamId ?? 'todas');

  // 1) Jogos considerados finalizados (final | concluido | completed)
  let query = supabase
    .from('games')
    .select('id, team_id, status')
    .in('status', [...STATUS_FINAL_VALUES]);
  if (teamId) {
    query = query.eq('team_id', teamId);
  }
  const { data: games, error: gamesError } = await query;

  if (gamesError) {
    console.error(`${LOG_PREFIX} Erro ao carregar jogos:`, gamesError);
    errors.push(`Erro ao carregar jogos: ${gamesError.message}`);
    return { updated: 0, errors };
  }

  console.log(`${LOG_PREFIX} Jogos finalizados:`, games?.length ?? 0, games?.map((g) => ({ id: g.id, status: (g as { status?: string }).status })) ?? []);

  if (!games?.length) {
    console.log(`${LOG_PREFIX} Nenhum jogo 'final'. Nada a atualizar.`);
    return { updated: 0, errors };
  }

  const gameIds = games.map((g) => g.id);
  const gameTeamIds = new Set(games.map((g) => g.team_id).filter(Boolean));

  // 2) Duplas desses jogos
  const { data: pairs, error: pairsError } = await supabase
    .from('pairs')
    .select('id, game_id, player1_id, player2_id')
    .in('game_id', gameIds);

  if (pairsError) {
    console.error(`${LOG_PREFIX} Erro ao carregar pairs:`, pairsError);
    errors.push(`Erro ao carregar duplas: ${pairsError.message}`);
    return { updated: 0, errors };
  }

  console.log(`${LOG_PREFIX} Duplas encontradas:`, pairs?.length ?? 0, pairs ?? []);

  // 3) Resultados por jogo (para saber quem ganhou/perdeu em cada dupla)
  const { data: results, error: resultsError } = await supabase
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
  console.log(`${LOG_PREFIX} Resultados por pair_id:`, resultByPair.size, Array.from(resultByPair.entries()).map(([pid, r]) => ({ pair_id: pid, win: isPairWin(r) })));

  // 4) Agregar pontos por jogador (apenas quem está nas duplas)
  const playerPoints = new Map<string, number>();
  for (const pair of pairs ?? []) {
    const res = resultByPair.get(pair.id);
    if (!res) continue;
    const won = isPairWin(res);
    const pts = won ? POINTS_WIN : POINTS_LOSS;
    for (const pid of [pair.player1_id, pair.player2_id].filter(Boolean)) {
      if (pid) {
        const cur = playerPoints.get(pid) ?? 0;
        playerPoints.set(pid, cur + pts);
        console.log(`${LOG_PREFIX} Dupla ${pair.id} (jogo ${pair.game_id}): ${won ? 'Vitória' : 'Derrota'} → ${pid} +${pts} (total: ${cur + pts})`);
      }
    }
  }

  // 5) Se recalc por equipa: pôr a 0 os jogadores da equipa que não têm pontos (não foram escalados)
  if (teamId) {
    const { data: teamPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('team_id', teamId);
    for (const p of teamPlayers ?? []) {
      if (!playerPoints.has(p.id)) {
        playerPoints.set(p.id, 0);
        console.log(`${LOG_PREFIX} Jogador ${p.id} (equipa): 0 convocatórias → 0 pontos`);
      }
    }
  } else {
    for (const tid of gameTeamIds) {
      if (!tid) continue;
      const { data: teamPlayers } = await supabase
        .from('players')
        .select('id')
        .eq('team_id', tid);
      for (const p of teamPlayers ?? []) {
        if (!playerPoints.has(p.id)) {
          playerPoints.set(p.id, 0);
        }
      }
    }
  }

  console.log(`${LOG_PREFIX} Totais por jogador:`, Object.fromEntries(playerPoints));

  /** Extrai mensagem legível do erro (Supabase devolve objeto, não Error). */
  const toErrorMsg = (e: unknown): string => {
    if (e instanceof Error) return e.message;
    if (typeof e === 'object' && e != null && 'message' in e) return String((e as { message?: string }).message);
    if (typeof e === 'object' && e != null && 'error_description' in e) return String((e as { error_description?: string }).error_description);
    return String(e);
  };

  // 6) Atualizar apenas liga_points (federation_points nunca é sobrescrito)
  let updated = 0;
  for (const [playerId, total] of playerPoints) {
    try {
      await updatePlayerLigaPoints(playerId, total);
      updated++;
    } catch (e) {
      const msg = toErrorMsg(e);
      if (import.meta.env?.DEV) console.error(`${LOG_PREFIX} PATCH falhou para ${playerId}:`, e);
      errors.push(`Jogador ${playerId}: ${msg}`);
    }
  }

  console.log(`${LOG_PREFIX} syncPlayerPoints fim. Atualizados: ${updated}. Erros: ${errors.length}`);
  return { updated, errors };
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
  /** Pontos Liga M6: 10 pts vitória, 3 pts derrota (calculado a partir do histórico). */
  pontos_liga: number;
  /** Pontos Federação: valor da coluna federation_points na tabela players. */
  federation_points: number;
  /** Pontos Totais: Pontos Liga + Pontos Federação. */
  total_points: number;
}

/**
 * Calcula se a equipa ganhou o jogo com base nos resultados (maioria de sets ganhos por dupla).
 * Usado quando team_points não está preenchido na BD.
 */
function teamWonFromResults(rows: ResultRow[]): boolean {
  let setsWon = 0;
  let setsLost = 0;
  for (const r of rows) {
    if (r.set1_casa != null && r.set1_fora != null) {
      if (Number(r.set1_casa) > Number(r.set1_fora)) setsWon += 1;
      else setsLost += 1;
    }
    if (r.set2_casa != null && r.set2_fora != null) {
      if (Number(r.set2_casa) > Number(r.set2_fora)) setsWon += 1;
      else setsLost += 1;
    }
    if (r.set3_casa != null && r.set3_fora != null) {
      if (Number(r.set3_casa) > Number(r.set3_fora)) setsWon += 1;
      else setsLost += 1;
    }
  }
  return setsWon > setsLost;
}

/**
 * Estatísticas da equipa na Liga Oficial M6.
 * Percorre games (team_id = M6): Vitória = 3 pts, Derrota = 1 pt, Falta = 0 pts.
 * Total = (Vitórias * 3) + (Derrotas * 1). Se team_points estiver null, calcula vitória/derrota a partir dos results (maioria de sets).
 */
export async function getTeamPerformanceStats(teamId: string): Promise<TeamPerformanceStats> {
  const effectiveTeamId = teamId || OFFICIAL_M6_TEAM_ID;

  const { data: games, error } = await supabase
    .from('games')
    .select('id, status, team_points, no_show')
    .eq('team_id', effectiveTeamId)
    .in('status', [...STATUS_TEAM_PERFORMANCE]);

  if (error) {
    console.error(`${LOG_PREFIX} getTeamPerformanceStats erro:`, error);
    return { wins: 0, losses: 0, noShows: 0, totalPoints: 0, record: '0-0-0' };
  }

  const list = games ?? [];
  if (list.length === 0) {
    return { wins: 0, losses: 0, noShows: 0, totalPoints: 0, record: '0-0-0' };
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

  console.log(`${LOG_PREFIX} getTeamPerformanceStats teamId=${effectiveTeamId} jogos=${list.length} V=${wins} D=${losses} F=${noShows} pts=${totalPoints}`);

  return {
    wins,
    losses,
    noShows,
    totalPoints,
    record: `${wins}-${losses}-${noShows}`,
  };
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
  const category = options?.category;
  console.log(`${LOG_PREFIX} getPlayerRanking início. teamId:`, teamId, 'category:', category ?? 'Geral');

  const { data: gamesRaw, error: gamesError } = await supabase
    .from('games')
    .select('id, team_id, status, phase')
    .in('status', [...STATUS_FINAL_VALUES])
    .eq('team_id', teamId);

  if (gamesError) {
    console.error(`${LOG_PREFIX} getPlayerRanking erro jogos:`, gamesError);
    return [];
  }

  const games =
    !category || category === 'Geral'
      ? gamesRaw ?? []
      : (gamesRaw ?? []).filter((g) => gameMatchesCategory((g as { phase?: string }).phase, category));

  if (!games?.length && category !== 'Treino') {
    console.log(`${LOG_PREFIX} getPlayerRanking sem jogos para categoria:`, category);
    if (category === 'Liga') {
      const { data: players } = await supabase.from('players').select('id, name, email').eq('team_id', teamId).neq('email', GESTOR_HIDE_EMAIL);
      const list = (players ?? []).map((p) => ({
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
    return [];
  }

  if (category === 'Treino') {
    const { data: players } = await supabase.from('players').select('id, name, email').eq('team_id', teamId).neq('email', GESTOR_HIDE_EMAIL);
    const list = (players ?? []).map((p) => ({
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
    console.log(`${LOG_PREFIX} getPlayerRanking sem duplas ou erro:`, pairsError);
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

  const playerStats = new Map<string, { wins: number; losses: number; points: number }>();
  for (const pair of pairsList) {
    const res = resultByPair.get(pair.id);
    if (!res) continue;
    const won = isPairWin(res);
    const pts = won ? POINTS_WIN : POINTS_LOSS;
    for (const pid of [pair.player1_id, pair.player2_id].filter(Boolean)) {
      if (!pid) continue;
      const cur = playerStats.get(pid) ?? { wins: 0, losses: 0, points: 0 };
      playerStats.set(pid, {
        wins: cur.wins + (won ? 1 : 0),
        losses: cur.losses + (won ? 0 : 1),
        points: cur.points + pts,
      });
    }
  }

  const playerIdsFromPairs = [...playerStats.keys()];
  const needAllTeamPlayers = category === 'Liga';
  const playerIds =
    needAllTeamPlayers
      ? (await supabase.from('players').select('id').eq('team_id', teamId).neq('email', GESTOR_HIDE_EMAIL)).data ?? []
      : playerIdsFromPairs;
  const ids = needAllTeamPlayers ? (playerIds as { id: string }[]).map((p) => p.id) : playerIdsFromPairs;
  if (ids.length === 0) return [];

  const { data: players } = await supabase
    .from('players')
    .select('id, name, email, federation_points, liga_points')
    .in('id', ids);

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

  if (useComputedLigaPoints) {
    for (const id of playerStats.keys()) {
      ligaPointsMap.set(id, playerStats.get(id)!.points);
    }
  }

  const out = ids
    .filter((id) => !isGestor(id))
    .map((id) => {
      const s = playerStats.get(id) ?? { wins: 0, losses: 0, points: 0 };
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

  console.log(`${LOG_PREFIX} getPlayerRanking resultado (category=${category ?? 'Geral'}):`, out.length, 'linhas');
  return out;
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
  /** Pontos Liga M6 (10v/3d) — coluna liga_points. */
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
 * - Pontos Liga M6: liga_points (10v/3d). Vitórias/Derrotas e Eficácia a partir de results.
 * - Com options.startDate/endDate, filtra por game_date no lado do cliente.
 */
export async function getSeasonStats(
  teamId: string,
  options?: GetSeasonStatsOptions
): Promise<GetSeasonStatsResult> {
  if (!teamId) return { rows: [], totalGamesInPeriod: 0 };

  const { startDate, endDate, category } = options ?? {};
  console.log(`${LOG_PREFIX} getSeasonStats início. teamId:`, teamId, options ? { startDate, endDate, category } : 'sem filtro');

  const { data: allTeamGames, error: gamesAllError } = await supabase
    .from('games')
    .select('id, game_date, starts_at, phase')
    .eq('team_id', teamId);

  if (gamesAllError || !allTeamGames?.length) return { rows: [], totalGamesInPeriod: 0 };

  const gamesWithDate = allTeamGames
    .filter((g) => gameMatchesCategory((g as { phase?: string }).phase, category))
    .map((g) => ({
      id: g.id,
      date: getGameDate(g as { game_date?: string; starts_at?: string }),
    }));

  const allGameIdsFiltered = gamesWithDate
    .filter((g) => isInDateRange(g.date, startDate, endDate))
    .map((g) => g.id);

  const totalGamesInPeriod = allGameIdsFiltered.length;

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

  const [availsRes, pairsFinalRes, resultsFinalRes, playersRes] = await Promise.all([
    supabase
      .from('availabilities')
      .select('game_id, player_id')
      .in('game_id', allGameIds)
      .eq('status', AVAILABILITY_CONFIRMED),
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
    supabase
      .from('players')
      .select('id, name, liga_points')
      .eq('team_id', teamId)
      .neq('email', GESTOR_HIDE_EMAIL),
  ]);

  if (availsRes.error || playersRes.error) return { rows: [], totalGamesInPeriod: 0 };
  const avails = availsRes.data ?? [];
  const players = playersRes.data ?? [];
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

  return {
    rows: rows.sort((a, b) => b.disponibilidade - a.disponibilidade),
    totalGamesInPeriod,
  };
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
