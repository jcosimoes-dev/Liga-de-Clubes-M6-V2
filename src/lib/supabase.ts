import { createClient } from "@supabase/supabase-js";

function readSupabaseEnv(key: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string | undefined {
  try {
    const im = import.meta as unknown as { env?: Record<string, string | undefined> };
    const v = im.env?.[key];
    if (typeof v === "string" && v.trim() !== "") return v;
  } catch {
    /* sem import.meta (ex.: alguns runners) */
  }
  if (typeof process !== "undefined" && process.env) {
    if (key === "VITE_SUPABASE_URL") {
      return process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || undefined;
    }
    return process.env.VITE_SUPABASE_ANON_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim() || undefined;
  }
  return undefined;
}

const supabaseUrl = readSupabaseEnv("VITE_SUPABASE_URL");
const supabaseAnonKey = readSupabaseEnv("VITE_SUPABASE_ANON_KEY");

if (!supabaseUrl) throw new Error("Falta VITE_SUPABASE_URL (ou SUPABASE_URL) no .env.local");
if (!supabaseAnonKey) throw new Error("Falta VITE_SUPABASE_ANON_KEY (ou SUPABASE_ANON_KEY) no .env.local");

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