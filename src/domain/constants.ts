/**
 * Domain constants (single source of truth).
 * Roles: player (default), captain, coordinator, admin.
 * JOGADOR | CAPITÃO | COORDENADOR | ADMINISTRADOR
 */

export const PlayerRoles = {
  player: 'player',
  captain: 'captain',
  coordinator: 'coordinator',
  admin: 'admin',
} as const;

export type PlayerRole = (typeof PlayerRoles)[keyof typeof PlayerRoles];

export const PreferredSides = {
  left: 'left',
  right: 'right',
  both: 'both',
} as const;

export type PreferredSide = (typeof PreferredSides)[keyof typeof PreferredSides];

/** Validate role before sending to API. Returns error message or null if valid. */
export function validateRole(value: unknown): string | null {
  if (
    value === PlayerRoles.player ||
    value === PlayerRoles.captain ||
    value === PlayerRoles.coordinator ||
    value === PlayerRoles.admin
  )
    return null;
  return `Role inválido. Use: ${PlayerRoles.player}, ${PlayerRoles.captain}, ${PlayerRoles.coordinator} ou ${PlayerRoles.admin}`;
}

/** Validate preferred_side before sending to API. Returns error message or null if valid. */
export function validatePreferredSide(value: unknown): string | null {
  if (value === PreferredSides.left || value === PreferredSides.right || value === PreferredSides.both) return null;
  return `Lado preferido inválido. Use: ${PreferredSides.left}, ${PreferredSides.right} ou ${PreferredSides.both}`;
}
