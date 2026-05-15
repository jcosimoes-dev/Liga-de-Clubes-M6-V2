/**
 * Pontuação da Liga M6 por jogo de eliminatória (equipa).
 * Valores fixos definidos pelo regulamento.
 *
 * Equipa ganhou + dupla ganhou          → 9.38
 * Equipa ganhou + dupla perdeu          → 6.25
 * Equipa ganhou + não escalado          → 3.13
 * Equipa perdeu + dupla ganhou          → 7.81
 * Equipa perdeu + dupla perdeu          → 4.69
 * Equipa perdeu + não escalado          → 1.56
 * Falta de comparência da equipa        → 0
 */

/** Ganhou a eliminatória, jogou e a dupla ganhou. */
export const LIGA_PTS_WIN_ELIM_PLAYED_WON_PAIR = 9.38;

/** Ganhou a eliminatória, jogou e a dupla perdeu. */
export const LIGA_PTS_WIN_ELIM_PLAYED_LOST_PAIR = 6.25;

/** Ganhou a eliminatória e não foi escalado. */
export const LIGA_PTS_WIN_ELIM_NO_PLAY = 3.13;

/** Perdeu a eliminatória, jogou e a dupla ganhou. */
export const LIGA_PTS_LOSS_ELIM_PLAYED_WON_PAIR = 7.81;

/** Perdeu a eliminatória, jogou e a dupla perdeu. */
export const LIGA_PTS_LOSS_ELIM_PLAYED_LOST_PAIR = 4.69;

/** Perdeu a eliminatória e não foi escalado (só pontos de jornada: 1.56). */
export const LIGA_PTS_LOSS_ELIM_NO_PLAY = 1.56;

/** Falta de comparência da equipa — 0 pontos. */
export const LIGA_PTS_NO_SHOW = 0;

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
    if (!playedWithScoredPair) return LIGA_PTS_WIN_ELIM_NO_PLAY;
    if (pairWonIndividual === true) return LIGA_PTS_WIN_ELIM_PLAYED_WON_PAIR;
    if (pairWonIndividual === false) return LIGA_PTS_WIN_ELIM_PLAYED_LOST_PAIR;
    return LIGA_PTS_WIN_ELIM_NO_PLAY;
  }

  if (!playedWithScoredPair) return LIGA_PTS_LOSS_ELIM_NO_PLAY;
  if (pairWonIndividual === true) return LIGA_PTS_LOSS_ELIM_PLAYED_WON_PAIR;
  if (pairWonIndividual === false) return LIGA_PTS_LOSS_ELIM_PLAYED_LOST_PAIR;
  return LIGA_PTS_LOSS_ELIM_NO_PLAY;
}

/** Arredonda totais para 2 casas decimais (armazenamento em NUMERIC na BD). */
export function roundLigaPointsTotal(total: number): number {
  return Math.round((Number.isFinite(total) ? total : 0) * 100) / 100;
}
