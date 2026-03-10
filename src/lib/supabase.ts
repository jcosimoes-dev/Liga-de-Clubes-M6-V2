import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl) throw new Error("Falta VITE_SUPABASE_URL no .env.local");
if (!supabaseAnonKey) throw new Error("Falta VITE_SUPABASE_ANON_KEY no .env.local");

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