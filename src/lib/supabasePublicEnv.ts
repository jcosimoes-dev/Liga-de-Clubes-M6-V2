/**
 * URL e anon key públicos do Supabase (browser).
 * Aceita na Vercel / .env:
 * - VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (recomendado), ou
 * - SUPABASE_URL + SUPABASE_ANON_KEY (inject via vite.config define no build).
 *
 * Nunca coloques aqui a service role.
 */
export function getSupabasePublicConfig(): { url: string; anonKey: string } | null {
  const url = String(
    import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || '',
  ).trim();
  const anonKey = String(
    import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY || '',
  ).trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabasePublicEnvReady(): boolean {
  return getSupabasePublicConfig() !== null;
}
