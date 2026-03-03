import { X, Copy, CheckCircle } from 'lucide-react';
import { Button } from './Button';
import { useState } from 'react';

interface PasswordModalProps {
  isOpen: boolean;
  playerName: string;
  temporaryPassword: string;
  onClose: () => void;
}

export function PasswordModal({ isOpen, playerName, temporaryPassword, onClose }: PasswordModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Password Redefinida
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 mb-2">
              A password de <strong>{playerName}</strong> foi redefinida com sucesso!
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password Temporária
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={temporaryPassword}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-lg"
              />
              <button
                onClick={handleCopy}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Copiar password"
              >
                {copied ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Importante:</strong> Guarde esta password e partilhe-a com o jogador de forma segura.
              Esta password não será exibida novamente.
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200">
          <Button onClick={onClose} fullWidth>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
