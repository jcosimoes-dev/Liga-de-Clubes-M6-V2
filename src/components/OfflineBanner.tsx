import { useOnlineStatus } from "../hooks/useOnlineStatus";

export default function OfflineBanner() {
  const online = useOnlineStatus();

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
        background: "rgba(0, 0, 0, 0.80)",
        border: "1px solid rgba(255, 200, 0, 0.45)",
        backdropFilter: "blur(8px)",
        color: "#fff8dc",
        textAlign: "center",
        fontWeight: 800,
        fontSize: 13,
        letterSpacing: "0.6px",
        textTransform: "uppercase",
        boxShadow: "0 10px 26px rgba(0,0,0,0.35)",
      }}
    >
      ⚠️ ESTÁS OFFLINE — A MOSTRAR DADOS GUARDADOS
    </div>
  );
}
