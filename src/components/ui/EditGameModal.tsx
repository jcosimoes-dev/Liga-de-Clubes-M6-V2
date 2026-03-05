import { useState, useEffect } from 'react';
import { X, Pencil } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { GamesService } from '../../services';

export type GameForEdit = {
  id: string;
  starts_at: string;
  location: string | null;
  status?: string;
};

interface EditGameModalProps {
  isOpen: boolean;
  game: GameForEdit | null;
  onClose: () => void;
  onSuccess: () => void;
}

/** Converte ISO string para valor datetime-local (yyyy-MM-ddThh:mm). */
function toDatetimeLocal(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

const COMPLETED_STATUSES = ['concluido', 'completed', 'closed'];

/**
 * Modal para editar Data/Hora e Localização de um jogo.
 * Só permite edição se o jogo não tiver resultado submetido (não concluído/fechado).
 */
export function EditGameModal({ isOpen, game, onClose, onSuccess }: EditGameModalProps) {
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCompleted = game?.status && COMPLETED_STATUSES.includes(game.status);

  useEffect(() => {
    if (game && isOpen) {
      setStartsAt(toDatetimeLocal(game.starts_at));
      setLocation(game.location ?? '');
      setError('');
    }
  }, [game, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game?.id || isCompleted) return;
    setError('');
    setSaving(true);
    try {
      const iso = startsAt ? new Date(startsAt).toISOString() : undefined;
      const loc = location.trim();
      await GamesService.updateGame(game.id, {
        ...(iso && { starts_at: iso }),
        ...(loc && { location: loc }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Pencil className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Editar Jogo</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 flex-1 overflow-y-auto">
          {isCompleted && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              Este jogo já foi concluído ou fechado e não pode ser editado.
            </div>
          )}
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <Input
            label="Data e Hora"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            disabled={isCompleted}
          />

          <Input
            label="Localização / Campo"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Clube ou pavilhão"
            disabled={isCompleted}
          />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={saving || isCompleted}>
              {saving ? 'A guardar...' : 'Guardar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
