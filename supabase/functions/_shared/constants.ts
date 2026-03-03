/**
 * Domain constants for edge functions. Must match src/domain/constants.ts
 */

export const PlayerRoles = {
  admin: "admin",
  player: "player",
} as const;

export type PlayerRole = (typeof PlayerRoles)[keyof typeof PlayerRoles];

export const PreferredSides = {
  left: "left",
  right: "right",
  both: "both",
} as const;

export type PreferredSide = (typeof PreferredSides)[keyof typeof PreferredSides];
