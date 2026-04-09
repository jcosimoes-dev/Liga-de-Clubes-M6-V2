import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./supabasePublicEnv";

const _cfg = getSupabasePublicConfig();
if (!_cfg) {
  throw new Error(
    "Faltam URL e anon key do Supabase. Na Vercel define VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ou SUPABASE_URL e SUPABASE_ANON_KEY) e faz redeploy.",
  );
}
const supabaseUrl = _cfg.url;
const supabaseAnonKey = _cfg.anonKey;

// Supabase client: storageKey nova para não reutilizar sessão antiga do Chrome (localStorage).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "liga-m6-auth-token",
  },
});

// ✅ gerir o auto-refresh conforme a ligação (evita spam de erros offline)
if (typeof window !== "undefined") {
  const stop = async () => {
    try {
      await supabase.auth.stopAutoRefresh();
    } catch {
      // ignora
    }
  };

  const start = async () => {
    try {
      await supabase.auth.startAutoRefresh();
    } catch {
      // ignora
    }
  };

  window.addEventListener("offline", stop);
  window.addEventListener("online", start);

  // aplica imediatamente
  if (!navigator.onLine) {
    stop();
  } else {
    start();
  }
}