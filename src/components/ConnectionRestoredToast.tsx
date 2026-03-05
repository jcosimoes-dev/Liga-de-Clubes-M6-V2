import { useEffect, useRef, useState } from "react";

export default function ConnectionRestoredToast() {
  const [show, setShow] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const wasOfflineRef = useRef(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      if (!wasOfflineRef.current) return;

      setShow(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setShow(false), 2000);

      wasOfflineRef.current = false;
    };

    const handleOffline = () => {
      wasOfflineRef.current = true;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!show) return null;

  return (
    <>
      <style>
        {`
          @keyframes slideDownToast {
            0% { transform: translate(-50%, -40px); opacity: 0; }
            100% { transform: translate(-50%, 0); opacity: 1; }
          }
        `}
      </style>

      <div
        style={{
          position: "fixed",
          top: 18,
          left: "50%",
          // 👇 deixa o transform ser controlado pela animação
          transform: "translate(-50%, 0)",
          background: "#00ff6a",
          color: "#003a18",
          padding: "12px 18px",
          borderRadius: 12,
          fontWeight: 900,
          zIndex: 10000,
          boxShadow: "0 0 14px rgba(0,255,120,0.7)",
          letterSpacing: "0.6px",
          textTransform: "uppercase",
          animation: "slideDownToast 0.35s ease-out",
        }}
      >
        ✔ LIGAÇÃO RESTABELECIDA
      </div>
    </>
  );
}