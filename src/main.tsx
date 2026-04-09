import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { DeploymentConfigError } from './components/DeploymentConfigError';

/**
 * Variáveis têm de existir no build da Vercel (Environment Variables).
 * Se falarem, não importar App (evita throw em supabase.ts = página em branco).
 */
function hasSupabaseBuildEnv(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
  return Boolean(url && key);
}

async function bootstrap(): Promise<void> {
  const rootEl = document.getElementById('root');
  if (!rootEl) return;

  if (!hasSupabaseBuildEnv()) {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <DeploymentConfigError />
      </React.StrictMode>,
    );
    return;
  }

  const [{ default: App }, { registerSW }] = await Promise.all([
    import('./App'),
    import('virtual:pwa-register'),
  ]);

  registerSW({ immediate: true });

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap().catch((err) => {
  console.error('[bootstrap]', err);
  const rootEl = document.getElementById('root');
  if (rootEl) {
    rootEl.innerHTML =
      '<p style="font-family:system-ui;padding:2rem;">Erro ao iniciar a aplicação. Abre as ferramentas de programador (Consola) para detalhes ou tenta atualizar a página.</p>';
  }
});