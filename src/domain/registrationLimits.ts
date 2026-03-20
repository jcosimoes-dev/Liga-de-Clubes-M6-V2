import type { GameCategory } from './categoryTheme';

/** Máximo de duplas por categoria de evento (inscrições / quadro de duplas). */
export function maxTeamsForCategory(category: GameCategory): number {
  return category === 'Liga' ? 3 : 10;
}

/** Máximo de jogadores que podem confirmar presença (= duplas × 2). */
export function maxPlayersForCategory(category: GameCategory): number {
  return maxTeamsForCategory(category) * 2;
}

/** Duplas “cheias” a partir do número de jogadores com presença confirmada. */
export function confirmedPairCountFromPlayers(confirmedPlayerCount: number): number {
  return Math.floor(confirmedPlayerCount / 2);
}

export function registrationLimitReachedMessage(maxTeams: number): string {
  return `Limite de ${maxTeams} duplas atingido para este evento`;
}

/** Linhas vazias do quadro de duplas (gestão de convocatórias). */
export function emptyPairSlots(count: number): Array<{ player1_id: string; player2_id: string }> {
  return Array.from({ length: count }, () => ({ player1_id: '', player2_id: '' }));
}
