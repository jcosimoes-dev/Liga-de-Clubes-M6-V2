import { useEffect, useMemo, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);

  const dismissed = localStorage.getItem("m6-install-dismissed");

  const isIOS = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua);
  }, []);

  const isStandalone = useMemo(() => {
    return (
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches
    );
  }, []);

  useEffect(() => {
    if (dismissed || isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BIPEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (isIOS) {
      setShowIOSHint(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed, isIOS, isStandalone]);

  const close = () => {
    localStorage.setItem("m6-install-dismissed", "true");
    setShowIOSHint(false);
    setDeferredPrompt(null);
  };

  if (dismissed || isStandalone) return null;

  if (deferredPrompt) {
    return (
      <div style={wrap}>
        <div style={card}>
          <b>Instalar App M6</b>
          <p>Instale a Equipa M6 Trablisa no seu telemóvel.</p>

          <button
            style={button}
            onClick={async () => {
              await deferredPrompt.prompt();
              await deferredPrompt.userChoice;
              close();
            }}
          >
            Instalar
          </button>

          <button style={secondary} onClick={close}>
            Agora não
          </button>
        </div>
      </div>
    );
  }

  if (showIOSHint) {
    return (
      <div style={wrap}>
        <div style={card}>
          <b>Instalar App M6</b>
          <p>
            No Safari toque em <b>Partilhar</b> e depois em{" "}
            <b>Adicionar ao ecrã principal</b>.
          </p>

          <button style={button} onClick={close}>
            Percebi
          </button>
        </div>
      </div>
    );
  }

  return null;
}

const wrap: React.CSSProperties = {
  position: "fixed",
  bottom: 20,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  zIndex: 9999,
};

const card: React.CSSProperties = {
  background: "#000",
  color: "#fff",
  padding: 16,
  borderRadius: 12,
  maxWidth: 320,
  textAlign: "center",
};

const button: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
};

const secondary: React.CSSProperties = {
  ...button,
  background: "transparent",
  color: "#aaa",
};