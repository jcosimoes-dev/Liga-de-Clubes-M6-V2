import { useEffect, useMemo, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isIOS = useMemo(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
    return iOS && isSafari;
  }, []);

  const isStandalone = useMemo(() => {
    // iOS
    const iosStandalone = (window.navigator as any).standalone === true;
    // others
    const displayStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
    return iosStandalone || !!displayStandalone;
  }, []);

  useEffect(() => {
    if (isStandalone) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BIPEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // iPhone: mostrar dica (não há botão real)
    if (isIOS) setShowIOSHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, [isIOS, isStandalone]);

  if (isStandalone || dismissed) return null;

  // ANDROID/CHROME: botão real
  if (deferredPrompt) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>Instalar a App</div>
          <div style={styles.text}>Instale a Equipa M6 Trablisa no seu telemóvel.</div>
          <div style={styles.row}>
            <button
              style={styles.primary}
              onClick={async () => {
                try {
                  await deferredPrompt.prompt();
                  const choice = await deferredPrompt.userChoice;
                  if (choice.outcome === "accepted") {
                    setDeferredPrompt(null);
                  } else {
                    setDismissed(true);
                  }
                } catch {
                  setDismissed(true);
                }
              }}
            >
              Instalar
            </button>
            <button style={styles.secondary} onClick={() => setDismissed(true)}>
              Agora não
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iPHONE/SAFARI: instruções
  if (showIOSHint) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.title}>Adicionar ao ecrã principal</div>
          <div style={styles.text}>
            No Safari, toque em <b>Partilhar</b> (⬆️) e depois em <b>Adicionar ao ecrã principal</b>.
          </div>
          <div style={styles.row}>
            <button style={styles.primary} onClick={() => setDismissed(true)}>
              Percebi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 14,
    display: "grid",
    placeItems: "center",
    zIndex: 9999,
    padding: "0 14px",
  },
  card: {
    width: "min(520px, 100%)",
    borderRadius: 16,
    background: "rgba(0,0,0,0.85)",
    color: "white",
    padding: 14,
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
    backdropFilter: "blur(8px)",
  },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
  text: { fontSize: 14, opacity: 0.92, lineHeight: 1.35 },
  row: { display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" },
  primary: {
    border: 0,
    borderRadius: 12,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondary: {
    border: 0,
    borderRadius: 12,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.12)",
    color: "white",
    fontWeight: 600,
    cursor: "pointer",
  },
};