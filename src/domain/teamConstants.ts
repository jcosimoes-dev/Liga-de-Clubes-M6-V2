/**
 * Identificador da equipa M6 em produção.
 * Confirma em Supabase → Table Editor → `teams` que existe uma linha com este `id`
 * (ou define `VITE_OFFICIAL_M6_TEAM_ID` no `.env` / Vercel Environment Variables).
 */
export const OFFICIAL_M6_TEAM_ID =
  (typeof import.meta !== 'undefined' &&
    import.meta.env?.VITE_OFFICIAL_M6_TEAM_ID &&
    String(import.meta.env.VITE_OFFICIAL_M6_TEAM_ID).trim()) ||
  '00000000-0000-0000-0000-000000000001';
