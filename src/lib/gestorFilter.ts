/**
 * Conta de utilizador usada apenas para administração (não joga).
 * Este email é excluído de listas públicas: Ranking, Convocatórias, Seleção de Duplas, Lista de Equipa.
 * João Simões (admin mas jogador) continua a aparecer; o filtro é só por este email.
 *
 * Pode ser sobrescrito por VITE_GESTOR_HIDE_EMAIL no .env.local.
 */
export const GESTOR_HIDE_EMAIL =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_GESTOR_HIDE_EMAIL?.trim()) ||
  'gestor@ligam6.pt';

const _emailNorm = (e: string | null | undefined) => (e ?? '').trim().toLowerCase();

export function isGestorAccount(player: { email?: string | null }): boolean {
  return _emailNorm(player.email) === _emailNorm(GESTOR_HIDE_EMAIL);
}

export function filterOutGestor<T extends { email?: string | null }>(list: T[]): T[] {
  return list.filter((p) => !isGestorAccount(p));
}
