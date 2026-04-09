import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };

type State = { error: Error | null };

/** Captura erros de renderização na árvore (ex.: excepções em providers). */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[RootErrorBoundary]', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: '1.5rem',
            fontFamily: 'system-ui, sans-serif',
            background: '#1e1b4b',
            color: '#e0e7ff',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>Erro ao mostrar a aplicação</h1>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: '0.875rem',
              opacity: 0.9,
            }}
          >
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
            Tenta atualizar a página. Se persistir, abre a consola do browser (F12) e envia o erro à equipa técnica.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
