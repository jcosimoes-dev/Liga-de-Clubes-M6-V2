import { useEffect, useRef, useState } from "react";

async function pingConnectivity(): Promise<boolean> {
  try {
    await fetch("https://www.gstatic.com/generate_204", {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Hook que verifica conectividade real com um ping HTTP.
 * navigator.onLine é pouco fiável e pode dar false mesmo com internet.
 * Começa a assumir `true` para evitar flash de "offline" no arranque.
 */
export function useOnlineStatus(intervalMs = 15_000): boolean {
  const [online, setOnline] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const verify = async () => {
      const result = await pingConnectivity();
      setOnline(result);
    };

    const init = setTimeout(verify, 1500);
    timerRef.current = setInterval(verify, intervalMs);

    window.addEventListener("online", verify);
    window.addEventListener("offline", verify);

    return () => {
      clearTimeout(init);
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener("online", verify);
      window.removeEventListener("offline", verify);
    };
  }, [intervalMs]);

  return online;
}
