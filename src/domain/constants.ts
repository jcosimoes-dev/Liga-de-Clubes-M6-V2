/**
 * Domain constants (single source of truth).
 * Roles na BD: admin, gestor, coordenador, capitao, jogador.
 * ADMIN | GESTOR | COORDENADOR | CAPITÃO | JOGADOR
 */

export const PlayerRoles = {
  admin: 'admin',
  gestor: 'gestor',
  coordenador: 'coordenador',
  capitao: 'capitao',
  jogador: 'jogador',
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
    value === PlayerRoles.admin ||
    value === PlayerRoles.gestor ||
    value === PlayerRoles.coordenador ||
    value === PlayerRoles.capitao ||
    value === PlayerRoles.jogador
  )
    return null;
  return `Role inválido. Use: ${PlayerRoles.admin}, ${PlayerRoles.gestor}, ${PlayerRoles.coordenador}, ${PlayerRoles.capitao} ou ${PlayerRoles.jogador}`;
}

/** Validate preferred_side before sending to API. Returns error message or null if valid. */
export function validatePreferredSide(value: unknown): string | null {
  if (value === PreferredSides.left || value === PreferredSides.right || value === PreferredSides.both) return null;
  return `Lado preferido inválido. Use: ${PreferredSides.left}, ${PreferredSides.right} ou ${PreferredSides.both}`;
}
