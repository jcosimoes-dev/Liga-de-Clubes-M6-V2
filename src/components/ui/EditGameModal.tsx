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
  phase?: string;
  end_date?: string | null;
  opponent?: string | null;
  round_number?: number;
};

interface EditGameModalProps {
  isOpen: boolean;
  game: GameForEdit | null;
  onClose: () => void;
  /** Recebe a linha devolvida pelo UPDATE (PostgREST); o pai deve fundir na lista e/ou refetch. */
  onSuccess: (updated: GameForEdit | null) => void | Promise<void>;
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

/** Converte ISO ou data para valor date (yyyy-MM-dd). */
function toDateOnly(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const COMPLETED_STATUSES = ['concluido', 'completed', 'closed', 'final'];

function isTorneioOrMix(phase: string | undefined): boolean {
  return phase === 'Torneio' || phase === 'Mix';
}

/**
 * Modal para editar Data/Hora (ou Data Início/Fim para multi-dia) e Localização de um jogo.
 * Para Torneio/Mix com end_date: mostra toggle "Evento de Vários Dias" ativo e campos Data Início e Data Fim.
 */
export function EditGameModal({ isOpen, game, onClose, onSuccess }: EditGameModalProps) {
  const [startsAt, setStartsAt] = useState('');
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [isMultiDayEvent, setIsMultiDayEvent] = useState(false);
  const [startDateOnly, setStartDateOnly] = useState('');
  const [endDateOnly, setEndDateOnly] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCompleted =
    Boolean(game?.status) && COMPLETED_STATUSES.includes(String(game?.status ?? ''));
  const canMultiDay = game && isTorneioOrMix(game.phase);

  useEffect(() => {
    if (game && isOpen) {
      setStartsAt(toDatetimeLocal(game.starts_at));
      setOpponent(game.opponent ?? '');
      setLocation(game.location ?? '');
      const hasEnd = game.end_date && String(game.end_date).trim() && String(game.end_date) !== 'null';
      const multi = canMultiDay && hasEnd;
      setIsMultiDayEvent(!!multi);
      setStartDateOnly(toDateOnly(game.starts_at));
      setEndDateOnly(multi ? toDateOnly(game.end_date!) : '');
      setError('');
    }
  }, [game, isOpen, canMultiDay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game?.id || isCompleted) return;
    setError('');
    setSaving(true);
    try {
      const payload: {
        starts_at?: string;
        end_date?: string | null;
        location?: string;
        opponent?: string;
      } = {
        location: location.trim(),
        opponent: (opponent.trim() || (game.opponent ?? '').trim() || 'Jogo').trim(),
      };

      if (canMultiDay && isMultiDayEvent) {
        if (!startDateOnly || !endDateOnly) {
          setError('Preenche a data de início e a data de fim.');
          setSaving(false);
          return;
        }
        payload.starts_at = new Date(startDateOnly + 'T00:00:00').toISOString();
        payload.end_date = endDateOnly.trim().split('T')[0] || null;
      } else {
        if (!startsAt) {
          setError('Indica a data e hora do jogo.');
          setSaving(false);
          return;
        }
        const d = new Date(startsAt);
        if (Number.isNaN(d.getTime())) {
          setError('Data ou hora inválida.');
          setSaving(false);
          return;
        }
        payload.starts_at = d.toISOString();
        if (canMultiDay && !isMultiDayEvent) payload.end_date = null;
      }

      const updated = await GamesService.updateGame(game.id, payload);
      if (!updated) {
        setError(
          'Não foi possível confirmar a gravação (a BD pode não ter devolvido a linha). Confirma permissões ou define VITE_SUPABASE_SERVICE_ROLE_KEY no .env.local para gravar como na Gestão de resultados.'
        );
        return;
      }
      await Promise.resolve(onSuccess(updated as GameForEdit | null));
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

          {canMultiDay && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={isMultiDayEvent}
                onClick={() => {
                  setIsMultiDayEvent((v) => !v);
                  if (!isMultiDayEvent) setEndDateOnly('');
                }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isMultiDayEvent ? 'bg-green-600' : 'bg-gray-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${isMultiDayEvent ? 'translate-x-5' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm font-medium text-gray-700">Evento de Vários Dias</span>
            </div>
          )}

          {canMultiDay && isMultiDayEvent ? (
            <>
              <Input
                label="Data de Início"
                type="date"
                value={startDateOnly}
                onChange={(e) => setStartDateOnly(e.target.value)}
                disabled={isCompleted}
                required
              />
              <Input
                label="Data de Fim"
                type="date"
                value={endDateOnly}
                onChange={(e) => setEndDateOnly(e.target.value)}
                disabled={isCompleted}
                required
              />
            </>
          ) : (
            <Input
              label="Data e Hora"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              disabled={isCompleted}
            />
          )}

          <Input
            label="Adversário / Nome do jogo"
            type="text"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
            placeholder="Ex.: Clube A vs Clube B"
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
