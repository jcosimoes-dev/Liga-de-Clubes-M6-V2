/**
 * Mostrado quando o bundle de produção não tem variáveis Supabase (ex.: Vercel sem env no build).
 * Evita página em branco por throw em supabase.ts antes do React montar.
 */
export function DeploymentConfigError() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#0f172a',
        color: '#e2e8f0',
      }}
    >
      <div style={{ maxWidth: 520, lineHeight: 1.6 }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: '#fff' }}>Configuração em falta</h1>
        <p style={{ marginBottom: '1rem' }}>
          A aplicação precisa das variáveis <strong>VITE_SUPABASE_URL</strong> e{' '}
          <strong>VITE_SUPABASE_ANON_KEY</strong> no <strong>momento do build</strong> na Vercel.
        </p>
        <ol style={{ paddingLeft: '1.25rem', marginBottom: '1rem' }}>
          <li>Vercel → o teu projeto → <strong>Settings</strong> → <strong>Environment Variables</strong></li>
          <li>
            Adiciona as duas variáveis (os mesmos valores que no <code style={{ color: '#94a3b8' }}>.env.local</code>)
            para <strong>Production</strong> (e Preview se usares).
          </li>
          <li>
            Faz um <strong>Redeploy</strong> (Deployments → ⋮ → Redeploy) para voltar a correr o build com as variáveis.
          </li>
        </ol>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
          Se já tinhas a app a funcionar e após um deploy ficou em branco, confirma que estas variáveis não foram
          apagadas e força um redeploy. Em modo local o <code>.env.local</code> continua a ser usado pelo Vite.
        </p>
      </div>
    </div>
  );
}
