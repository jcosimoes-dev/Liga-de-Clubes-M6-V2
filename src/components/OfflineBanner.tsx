import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,

        width: "min(520px, calc(100vw - 24px))",
        padding: "10px 14px",
        borderRadius: 999,

        background: "rgba(0, 200, 120, 0.18)", // verde suave
        border: "1px solid rgba(0, 255, 160, 0.35)",
        backdropFilter: "blur(8px)",

        color: "#eafff3",
        textAlign: "center",
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: "0.6px",
        textTransform: "uppercase",
        boxShadow: "0 10px 26px rgba(0,0,0,0.25)",
      }}
    >
      ⚠️ ESTÁS OFFLINE — A MOSTRAR DADOS GUARDADOS
    </div>
  );
}