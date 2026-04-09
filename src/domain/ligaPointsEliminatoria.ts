/**
 * Pontuação da Liga M6 por jogo de eliminatória (equipa).
 * Valores fixos definidos pelo regulamento.
 */

/** Ganhou a eliminatória e não foi escalado (sem resultado de dupla neste jogo). */
export const LIGA_PTS_WIN_ELIM_NO_PLAY = 3.13;

/** Ganhou a eliminatória, jogou (dupla com resultado) e a dupla ganhou ao nível dos sets. */
export const LIGA_PTS_WIN_ELIM_PLAYED_WON_PAIR = 9.38;

/** Ganhou a eliminatória, jogou e a dupla perdeu ao nível dos sets. */
export const LIGA_PTS_WIN_ELIM_PLAYED_LOST_PAIR = 6.25;

/** Perdeu a eliminatória e não foi escalado neste jogo. */
export const LIGA_PTS_LOSS_ELIM_NO_PLAY = 1.56;

/**
 * Perdeu a eliminatória mas esteve escalado (com resultado de dupla).
 * Não consta nas quatro regras explícitas — mantém-se 0 até haver valor oficial.
 */
export const LIGA_PTS_LOSS_ELIM_PLAYED = 0;

export interface LigaEliminatoriaPointInput {
  /** A equipa ganhou o confronto de eliminatória (ex.: por `team_points` ou soma dos sets das duplas). */
  teamWonElimination: boolean;
  /**
   * Jogador está numa dupla com linha em `results` para este jogo (permite saber vitória/derrota da dupla).
   */
  playedWithScoredPair: boolean;
  /**
   * Se `playedWithScoredPair`: a dupla ganhou (mais sets ganhos que perdidos). Ignorado se não jogou com resultado.
   */
  pairWonIndividual: boolean | null;
}

/**
 * Pontos de liga atribuídos a um jogador por um único jogo de eliminatória,
 * consoante o resultado da equipa e se jogou / resultado da sua dupla.
 */
export function computeLigaPointsForEliminatoriaGame(input: LigaEliminatoriaPointInput): number {
  const { teamWonElimination, playedWithScoredPair, pairWonIndividual } = input;

  if (teamWonElimination) {
    if (!playedWithScoredPair) {
      return LIGA_PTS_WIN_ELIM_NO_PLAY;
    }
    if (pairWonIndividual === true) {
      return LIGA_PTS_WIN_ELIM_PLAYED_WON_PAIR;
    }
    if (pairWonIndividual === false) {
      return LIGA_PTS_WIN_ELIM_PLAYED_LOST_PAIR;
    }
    return 0;
  }

  if (!playedWithScoredPair) {
    return LIGA_PTS_LOSS_ELIM_NO_PLAY;
  }

  return LIGA_PTS_LOSS_ELIM_PLAYED;
}

/** Arredonda totais para 2 casas decimais (armazenamento em NUMERIC na BD). */
export function roundLigaPointsTotal(total: number): number {
  return Math.round((Number.isFinite(total) ? total : 0) * 100) / 100;
}
