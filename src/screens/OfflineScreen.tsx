export function OfflineScreen() {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "30px",
          fontFamily: "system-ui",
          background: "#0f172a",
          color: "white",
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 24 }}>📡</div>
  
        <h2
          style={{
            marginBottom: 12,
            fontWeight: 900,
            letterSpacing: "1px",
          }}
        >
          SEM LIGAÇÃO À INTERNET
        </h2>
  
        <p
          style={{
            opacity: 0.8,
            maxWidth: 360,
            lineHeight: 1.5,
            marginBottom: 20,
          }}
        >
          Para iniciar sessão na app da <strong>Equipa M6 TRABLISA</strong> é
          necessário ter ligação à internet.
        </p>
  
        <div
          style={{
            padding: "12px 20px",
            background: "#00ff6a",
            color: "#003a18",
            borderRadius: 12,
            fontWeight: 900,
            letterSpacing: "0.5px",
            boxShadow: "0 0 12px rgba(0,255,120,0.6)",
          }}
        >
          LIGA O WI-FI OU OS DADOS MÓVEIS
        </div>
  
        <p
          style={{
            marginTop: 22,
            opacity: 0.6,
            fontSize: 14,
          }}
        >
          A aplicação continuará automaticamente quando a ligação voltar.
        </p>
      </div>
    );
  }