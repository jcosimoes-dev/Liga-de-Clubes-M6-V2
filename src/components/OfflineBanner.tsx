import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (online) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        left: 10,
        right: 10,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        color: "white",
        padding: "10px",
        borderRadius: "10px",
        textAlign: "center",
        fontSize: "14px"
      }}
    >
      ⚠️ Estás offline — a mostrar dados guardados
    </div>
  );
}