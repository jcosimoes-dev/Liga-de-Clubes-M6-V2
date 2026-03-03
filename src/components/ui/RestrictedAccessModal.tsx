import { Lock } from 'lucide-react';
import { Button } from './Button';

const DEFAULT_MESSAGE =
  'Acesso Restrito: Esta área é reservada a Coordenadores e Administradores. Contacta o responsável da equipa se precisares de acesso.';

interface RestrictedAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Mensagem personalizada (ex.: para Administração: reservada a Administradores) */
  message?: string;
}

export function RestrictedAccessModal({
  isOpen,
  onClose,
  message = DEFAULT_MESSAGE,
}: RestrictedAccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="p-6 bg-amber-50 border-b border-amber-200">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Acesso Restrito</h3>
              <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{message}</p>
            </div>
          </div>
        </div>
        <div className="p-4 flex justify-end">
          <Button onClick={onClose}>Entendi</Button>
        </div>
      </div>
    </div>
  );
}
