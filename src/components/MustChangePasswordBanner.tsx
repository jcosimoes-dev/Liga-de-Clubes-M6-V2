import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { AlertTriangle, KeyRound } from 'lucide-react';

/**
 * Banner exibido quando o jogador está a usar uma password temporária (redefinida pelo admin).
 * Leva-o a alterar a password no ecrã de perfil (Equipa).
 */
export function MustChangePasswordBanner() {
  const { mustChangePassword } = useAuth();
  const { navigate } = useNavigation();

  if (!mustChangePassword) return null;

  return (
    <div
      role="alert"
      className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <div className="flex items-start sm:items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" aria-hidden />
        <p className="text-sm text-amber-800">
          Estás a usar uma password temporária. Por motivos de segurança, deves alterá-la agora para uma da tua preferência.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate({ name: 'team' })}
        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors whitespace-nowrap"
      >
        <KeyRound className="w-4 h-4" />
        Alterar password
      </button>
    </div>
  );
}
