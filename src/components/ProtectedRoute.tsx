import { useAuth } from '../contexts/AuthContext';
import { Loading } from './ui/Loading';

/**
 * Proteção infalível: só renderiza children se user existir.
 * loading true → Spinner. user null → redirect para /login (equivalente a <Navigate to="/login" replace />).
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, session, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#121212]">
        <Loading size="lg" text="Carregando..." />
      </div>
    );
  }

  if (!user || !session) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#121212]">
        <Loading size="lg" text="A redirecionar para o Login..." />
      </div>
    );
  }

  return <>{children}</>;
}
