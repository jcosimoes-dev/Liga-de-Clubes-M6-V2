import type { GameCategory } from './categoryTheme';

/**
 * v1.8.0: sem limite rígido de 3 duplas / 6 jogadores por categoria na aplicação.
 * Valor alto só para compatibilidade se algum código legado consultar estes helpers.
 */
const UNLIMITED_MAX_TEAMS = 500;

/** @deprecated Preferir pairSlotsForConvocatory / sem teto na UI — retorno alto, não 3/10. */
export function maxTeamsForCategory(_category: GameCategory): number {
  return UNLIMITED_MAX_TEAMS;
}

/** @deprecated Sem limite de inscrições no cliente. */
export function maxPlayersForCategory(_category: GameCategory): number {
  return UNLIMITED_MAX_TEAMS * 2;
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

/**
 * Número de linhas no quadro de duplas na gestão de convocatórias.
 * Respeita o máximo de duplas por tipo de jogo quando fornecido.
 */
export function pairSlotsForConvocatory(
  minPlayers: number,
  selectedPlayerCount: number,
  maxPairs?: number,
): number {
  const minSlots = Math.ceil(minPlayers / 2);
  const fromSelection = Math.ceil(selectedPlayerCount / 2);
  const slots = Math.max(minSlots, fromSelection);
  return maxPairs !== undefined ? Math.min(slots, maxPairs) : slots;
}
