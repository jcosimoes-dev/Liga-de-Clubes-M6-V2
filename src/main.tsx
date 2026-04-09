import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { DeploymentConfigError } from './components/DeploymentConfigError';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { isSupabasePublicEnvReady } from './lib/supabasePublicEnv';

/**
 * URL + anon key têm de existir no bundle (VITE_* ou SUPABASE_* injetados no build — ver vite.config).
 */
function hasSupabaseBuildEnv(): boolean {
  return isSupabasePublicEnvReady();
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

  /** Depois do primeiro paint — evita o SW a competir com o carregamento inicial dos chunks. */
  requestAnimationFrame(() => {
    registerSW({ immediate: true });
  });

  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
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