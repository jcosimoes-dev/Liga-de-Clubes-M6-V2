/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite/client" />

/** Injetados no build a partir de SUPABASE_URL / SUPABASE_ANON_KEY (sem prefixo VITE_). */
interface ImportMetaEnv {
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
}
