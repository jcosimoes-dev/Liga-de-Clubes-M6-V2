import { useAuth } from '../contexts/AuthContext';

export default function ProfileLoadErrorBanner() {
  const { profileLoadError } = useAuth();

  if (!profileLoadError) return null;

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
        borderRadius: 12,

        background: "rgba(180, 83, 9, 0.15)",
        border: "1px solid rgba(217, 119, 6, 0.4)",
        backdropFilter: "blur(8px)",

        color: "#92400e",
        textAlign: "center",
        fontWeight: 600,
        fontSize: 13,
        boxShadow: "0 10px 26px rgba(0,0,0,0.15)",
      }}
    >
      ⚠️ {profileLoadError}
    </div>
  );
}
