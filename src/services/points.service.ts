import { supabase } from '../lib/supabase';
import { updatePlayerFederationPoints } from './adminAuth';

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
 * Determina se a dupla ganhou com base nos sets (casa vs fora).
 * Vitória = +10 pts, Derrota = +3 pts.
 */
function isPairWin(r: ResultRow): boolean {
  const casa =
    (Number(r.set1_casa) || 0) +
    (Number(r.set2_casa) || 0) +
    (Number(r.set3_casa) || 0);
  const fora =
    (Number(r.set1_fora) || 0) +
    (Number(r.set2_fora) || 0) +
    (Number(r.set3_fora) || 0);
  return casa > fora;
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

  // 6) Atualizar federation_points (admin client ignora RLS)
  let updated = 0;
  for (const [playerId, total] of playerPoints) {
    try {
      await updatePlayerFederationPoints(playerId, total);
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

export interface PlayerRankingRow {
  player_id: string;
  name: string;
  wins: number;
  losses: number;
  total_points: number;
}

/**
 * Ranking da equipa com base em jogos 'final': usa duplas + resultados (não availabilities).
 * +10 por vitória da dupla, +3 por derrota.
 */
export async function getPlayerRanking(teamId: string): Promise<PlayerRankingRow[]> {
  console.log(`${LOG_PREFIX} getPlayerRanking início. teamId:`, teamId);

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, team_id, status')
    .in('status', [...STATUS_FINAL_VALUES])
    .eq('team_id', teamId);

  if (gamesError) {
    console.error(`${LOG_PREFIX} getPlayerRanking erro jogos:`, gamesError);
    return [];
  }

  console.log(`${LOG_PREFIX} getPlayerRanking jogos finalizados:`, games?.length ?? 0, games?.map((g) => ({ id: g.id, status: (g as { status?: string }).status })) ?? []);

  if (!games?.length) return [];

  const gameIds = games.map((g) => g.id);

  const { data: pairs, error: pairsError } = await supabase
    .from('pairs')
    .select('id, game_id, player1_id, player2_id')
    .in('game_id', gameIds);

  if (pairsError || !pairs?.length) {
    console.log(`${LOG_PREFIX} getPlayerRanking sem duplas ou erro:`, pairsError);
    return [];
  }

  const { data: results, error: resultsError } = await supabase
    .from('results')
    .select('game_id, pair_id, set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora')
    .in('game_id', gameIds);

  if (resultsError) {
    console.error(`${LOG_PREFIX} getPlayerRanking erro results:`, resultsError);
    return [];
  }

  const resultByPair = new Map<string, ResultRow>();
  for (const r of results ?? []) {
    resultByPair.set((r as { pair_id: string }).pair_id, r as ResultRow);
  }

  const playerStats = new Map<string, { wins: number; losses: number; points: number }>();
  for (const pair of pairs) {
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

  const playerIds = [...playerStats.keys()];
  if (playerIds.length === 0) return [];

  const { data: players } = await supabase
    .from('players')
    .select('id, name')
    .in('id', playerIds);
  const nameMap = new Map((players ?? []).map((p) => [p.id, p.name ?? '—']));

  const out = playerIds
    .map((id) => {
      const s = playerStats.get(id)!;
      return {
        player_id: id,
        name: nameMap.get(id) ?? '—',
        wins: s.wins,
        losses: s.losses,
        total_points: s.points,
      };
    })
    .sort((a, b) => b.total_points - a.total_points);

  console.log(`${LOG_PREFIX} getPlayerRanking resultado:`, out);
  return out;
}

/** Status considerado "check verde" para disponibilidade */
const AVAILABILITY_CONFIRMED = 'confirmed';

export interface SeasonStatRow {
  player_id: string;
  name: string;
  disponibilidade: number;
  convocatorias: number;
  taxa_escolha: number;
  pontos_ranking: number;
  highlight_rodar: boolean;
}

/**
 * Estatísticas de época:
 * - Disponibilidade: apenas registos em availabilities com status 'confirmed' (check verde).
 * - Convocatórias: apenas vezes que o jogador aparece nas 3 duplas de um jogo com status 'final'.
 * - Pontos Ranking: soma real (10 por vitória da dupla, 3 por derrota); se convocatórias = 0 → 0 pontos (nunca valor manual).
 */
export async function getSeasonStats(teamId: string): Promise<SeasonStatRow[]> {
  if (!teamId) return [];

  console.log(`${LOG_PREFIX} getSeasonStats início. teamId:`, teamId);

  // Jogos da equipa (todos, para disponibilidade)
  const { data: allTeamGames, error: gamesAllError } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId);

  if (gamesAllError || !allTeamGames?.length) return [];
  const allGameIds = allTeamGames.map((g) => g.id);

  // Apenas jogos finalizados (para convocatórias e pontos)
  const { data: finalGames, error: finalError } = await supabase
    .from('games')
    .select('id')
    .eq('team_id', teamId)
    .in('status', [...STATUS_FINAL_VALUES]);

  const finalGameIds = (finalGames ?? []).map((g) => g.id);
  console.log(`${LOG_PREFIX} getSeasonStats jogos finalizados da equipa:`, finalGameIds.length, finalGameIds);

  const [availsRes, pairsAllRes, pairsFinalRes, resultsFinalRes, playersRes] = await Promise.all([
    supabase
      .from('availabilities')
      .select('game_id, player_id')
      .in('game_id', allGameIds)
      .eq('status', AVAILABILITY_CONFIRMED),
    supabase
      .from('pairs')
      .select('game_id, player1_id, player2_id')
      .in('game_id', allGameIds),
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
      .select('id, name, federation_points')
      .eq('team_id', teamId),
  ]);

  if (availsRes.error || playersRes.error) return [];
  const avails = availsRes.data ?? [];
  const players = playersRes.data ?? [];
  const pairsFinal = (pairsFinalRes as { data?: { id: string; game_id: string; player1_id: string; player2_id: string }[] }).data ?? [];
  const resultsFinalRaw = (resultsFinalRes as { data?: (ResultRow & { pair_id?: string })[] }).data ?? [];
  const resultsFinal = resultsFinalRaw as ResultRow[];

  // Disponibilidade: contagem de 'confirmed' por jogador
  const disponibilidadeByPlayer = new Map<string, number>();
  for (const a of avails) {
    if (a.player_id) {
      disponibilidadeByPlayer.set(a.player_id, (disponibilidadeByPlayer.get(a.player_id) ?? 0) + 1);
    }
  }
  console.log(`${LOG_PREFIX} getSeasonStats disponibilidade (check verde):`, Object.fromEntries(disponibilidadeByPlayer));

  // Convocatórias: apenas jogos 'final', contagem de jogos em que o jogador está numa dupla
  const convocatoriasByPlayer = new Map<string, Set<string>>();
  for (const p of pairsFinal) {
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
  console.log(`${LOG_PREFIX} getSeasonStats convocatórias (duplas em jogos 'final'):`, Object.fromEntries([...convocatoriasByPlayer.entries()].map(([k, v]) => [k, v.size])));

  // Pontos ranking: mostrar federation_points da tabela players (sincronizados pelo recálculo +10/+3).
  const rows: SeasonStatRow[] = players.map((pl) => {
    const disp = disponibilidadeByPlayer.get(pl.id) ?? 0;
    const convSet = convocatoriasByPlayer.get(pl.id);
    const conv = convSet ? convSet.size : 0;
    const taxa = disp > 0 ? Math.round((conv / disp) * 100) : 0;
    const pontos = typeof (pl as { federation_points?: number }).federation_points === 'number'
      ? (pl as { federation_points: number }).federation_points
      : 0;
    const highlight_rodar = disp >= 2 && (disp > conv || taxa < 50);
    return {
      player_id: pl.id,
      name: pl.name ?? '—',
      disponibilidade: disp,
      convocatorias: conv,
      taxa_escolha: taxa,
      pontos_ranking: pontos,
      highlight_rodar,
    };
  });
  console.log(`${LOG_PREFIX} getSeasonStats federation_points por jogador:`, rows.map((r) => ({ name: r.name, disponibilidade: r.disponibilidade, federation_points: r.pontos_ranking })));

  return rows.sort((a, b) => b.pontos_ranking - a.pontos_ranking);
}

/**
 * Zera a coluna federation_points de todos os jogadores (ou apenas da equipa indicada).
 * Útil para limpar erros antes de recalcular.
 */
export async function resetAllPlayerPoints(teamId?: string): Promise<{ updated: number; error?: string }> {
  console.log(`${LOG_PREFIX} resetAllPlayerPoints. teamId:`, teamId ?? 'todas');

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
      await updatePlayerFederationPoints(id, 0);
      updated++;
    } catch (e) {
      console.error(`${LOG_PREFIX} resetAllPlayerPoints falha em ${id}:`, e);
      return { updated, error: e instanceof Error ? e.message : String(e) };
    }
  }

  console.log(`${LOG_PREFIX} resetAllPlayerPoints fim. Zerados: ${updated} jogadores.`);
  return { updated };
}
