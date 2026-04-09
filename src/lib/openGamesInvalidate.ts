/**
 * Sem React Query/SWR: ecrãs com useState em jogos abertos podem subscrever este evento
 * para refetch quando outro ecrã grava alterações (ex.: Editar Jogo na Gestão).
 */
export const OPEN_GAMES_INVALIDATE_EVENT = 'liga-m6:invalidate-open-games';

export function invalidateOpenGamesListCaches(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_GAMES_INVALIDATE_EVENT));
}
