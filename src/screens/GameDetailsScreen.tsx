import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Header, Loading, Toast, ToastType, Badge, ConfirmDialog } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { supabase } from '../lib/supabase';
import { GamesService, PairsService, ResultsService, AvailabilitiesService } from '../services';
import { PlayerRoles } from '../domain/constants';

type Props = {
  id?: string;
};

function getErrorMessage(err: unknown): string {
  if (!err) return 'Erro inesperado';
  if (err instanceof Error) return err.message || 'Erro inesperado';
  if (typeof err === 'object' && err && 'message' in err) {
    const m = (err as any).message;
    return typeof m === 'string' ? m : 'Erro inesperado';
  }
  return String(err);
}

function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

export function GameDetailsScreen({ id }: Props) {
  const { navigate } = useNavigation();
  const { user, role } = useAuth();
  const gameId = id && String(id).trim() ? String(id).trim() : null;
  const isLoggedIn = Boolean(user?.id);
  // Apenas admin e coordenador podem gravar resultados; capitão e jogador têm inputs em readOnly e sem botão Gravar.
  const canSaveResults = role === PlayerRoles.admin || role === PlayerRoles.coordinator;
  const isReadOnlyByRole = !canSaveResults;

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<any>(null);
  const [pairs, setPairs] = useState<any[]>([]);
  const [confirmedPlayers, setConfirmedPlayers] = useState<any[]>([]);
  const [results, setResults] = useState<Record<string, { set1_casa: number; set1_fora: number; set2_casa: number; set2_fora: number; set3_casa: number | null; set3_fora: number | null }>>({});
  const [saving, setSaving] = useState(false);
  const [showConfirmGravar, setShowConfirmGravar] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const defaultSetRow = {
    set1_casa: 0,
    set1_fora: 0,
    set2_casa: 0,
    set2_fora: 0,
    set3_casa: null as number | null,
    set3_fora: null as number | null,
  };

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      showToast('Jogo inválido: falta o id', 'error');
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const gamesCols = 'id, status, opponent, starts_at, location, phase, round_number';
        const { data, error } = await supabase.from('games').select(gamesCols).eq('id', gameId).maybeSingle();

        if (error) throw error;
        setGame(data ?? null);
        if (!data) {
          showToast('Jogo não encontrado', 'error');
          setLoading(false);
          return;
        }

        const isClosed = ['convocatoria_fechada', 'closed', 'concluido', 'completed'].includes(data.status ?? '');
        if (isClosed) {
          const pairsData = await PairsService.getByGame(gameId);
          setPairs(Array.isArray(pairsData) ? pairsData : []);
        } else {
          setPairs([]);
        }
        try {
          const players = await AvailabilitiesService.getConfirmedPlayers(gameId);
          setConfirmedPlayers(Array.isArray(players) ? players : []);
        } catch {
          setConfirmedPlayers([]);
        }
        setResults({});
      } catch (e) {
        console.error('[GameDetailsScreen] Erro ao carregar:', e);
        showToast(getErrorMessage(e), 'error');
      } finally {
        setLoading(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  if (loading) {
    return (
      <Layout>
        <Header title="Jogo" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4">
          <Loading text="A carregar..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Jogo" />

      <div className="max-w-screen-sm mx-auto px-4 pt-4 space-y-4">
        {!game ? (
          <Card>
            <p className="text-sm text-gray-700">Não foi possível carregar o jogo.</p>
            <div className="mt-4">
              <Button variant="primary" fullWidth onClick={() => navigate({ name: 'home' })}>
                Voltar ao Início
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">{GamesService.formatOpponentDisplay(game.opponent) || 'Adversário'}</h2>
                  {game.status ? <Badge variant="default">{String(game.status)}</Badge> : null}
                </div>

                <p className="text-sm text-gray-700">
                  <strong>Data:</strong>{' '}
                  {game.starts_at ? new Date(game.starts_at).toLocaleString('pt-PT') : '—'}
                </p>

                <p className="text-sm text-gray-700">
                  <strong>Local:</strong> {game.location || '—'}
                </p>
              </div>

              <div className="mt-4">
                <Button variant="ghost" fullWidth onClick={() => navigate({ name: 'home' })}>
                  Voltar ao Início
                </Button>
              </div>
            </Card>

            {confirmedPlayers.length > 0 && (
              <Card>
                <h3 className="text-base font-semibold text-gray-900 mb-2">Jogadores que confirmaram</h3>
                <p className="text-sm text-gray-600 mb-2">Lista visível para todos os elementos da equipa.</p>
                <ul className="space-y-1">
                  {confirmedPlayers.map((p: any) => (
                    <li key={p.id} className="text-sm text-gray-700">
                      {p.name ?? '—'}
                      {p.federation_points != null ? ` (${p.federation_points} pts)` : ''}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {['convocatoria_fechada', 'closed', 'concluido', 'completed'].includes(game.status ?? '') && pairs.length > 0 && (
              <Card>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Quadro de Resultados</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Introduz os resultados de cada dupla. Set 1 e Set 2 são obrigatórios. Set 3 só se o resultado for 1-1.
                </p>
                <div className="space-y-6">
                  {pairs.map((pair: any) => {
                    const pairId = pair?.id ?? '';
                    const res = results[pairId] ?? defaultSetRow;
                    const p1 = pair.player1?.name ?? '—';
                    const p2 = pair.player2?.name ?? '—';
                    const isReadOnly = ['concluido', 'completed'].includes(game.status ?? '') || isReadOnlyByRole;
                    return (
                      <div key={pairId} className="p-4 rounded-lg border border-gray-200 bg-gray-50 space-y-3" data-pair-id={pairId}>
                        <div className="font-medium text-gray-900">
                          {p1} + {p2}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Set 1 (casa - fora)</label>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min={0}
                                max={7}
                                placeholder="6"
                                value={res.set1_casa ?? ''}
                                readOnly={isReadOnly}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                onChange={(e) => {
                                  const v = toNum(e.target.value);
                                  setResults((prev) => ({
                                    ...prev,
                                    [pairId]: {
                                      ...defaultSetRow,
                                      ...prev[pairId],
                                      set1_casa: v ?? 0,
                                    },
                                  }));
                                }}
                              />
                              <span className="flex items-center">-</span>
                              <input
                                type="number"
                                min={0}
                                max={7}
                                placeholder="4"
                                value={res.set1_fora ?? ''}
                                readOnly={isReadOnly}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                onChange={(e) => {
                                  const v = toNum(e.target.value);
                                  setResults((prev) => ({
                                    ...prev,
                                    [pairId]: { ...defaultSetRow, ...prev[pairId], set1_fora: v ?? 0 },
                                  }));
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Set 2 (casa - fora)</label>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min={0}
                                max={7}
                                placeholder="6"
                                value={res.set2_casa ?? ''}
                                readOnly={isReadOnly}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                onChange={(e) => {
                                  const v = toNum(e.target.value);
                                  setResults((prev) => ({
                                    ...prev,
                                    [pairId]: { ...defaultSetRow, ...prev[pairId], set2_casa: v ?? 0 },
                                  }));
                                }}
                              />
                              <span className="flex items-center">-</span>
                              <input
                                type="number"
                                min={0}
                                max={7}
                                placeholder="4"
                                value={res.set2_fora ?? ''}
                                readOnly={isReadOnly}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                onChange={(e) => {
                                  const v = toNum(e.target.value);
                                  setResults((prev) => ({
                                    ...prev,
                                    [pairId]: { ...defaultSetRow, ...prev[pairId], set2_fora: v ?? 0 },
                                  }));
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Set 3 (opcional)</label>
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min={0}
                                max={7}
                                placeholder="—"
                                value={res.set3_casa ?? ''}
                                readOnly={isReadOnly}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                onChange={(e) => {
                                  const v = toNum(e.target.value);
                                  setResults((prev) => ({
                                    ...prev,
                                    [pairId]: { ...defaultSetRow, ...prev[pairId], set3_casa: v },
                                  }));
                                }}
                              />
                              <span className="flex items-center">-</span>
                              <input
                                type="number"
                                min={0}
                                max={7}
                                placeholder="—"
                                value={res.set3_fora ?? ''}
                                readOnly={isReadOnly}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                onChange={(e) => {
                                  const v = toNum(e.target.value);
                                  setResults((prev) => ({
                                    ...prev,
                                    [pairId]: { ...defaultSetRow, ...prev[pairId], set3_fora: v },
                                  }));
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {canSaveResults && (
                  <>
                    <Button
                      fullWidth
                      className="mt-4"
                      disabled={saving || !isLoggedIn || ['concluido', 'completed'].includes(game.status ?? '')}
                      onClick={() => {
                        if (!gameId || saving) return;
                        if (!isLoggedIn || !user?.id) {
                          showToast('Não estás autenticado. Inicia sessão para guardar resultados.', 'error');
                          return;
                        }
                        setShowConfirmGravar(true);
                      }}
                    >
                      {saving ? 'A guardar...' : !isLoggedIn ? 'Inicia sessão para guardar' : ['concluido', 'completed'].includes(game.status ?? '') ? 'Resultados Guardados' : 'Gravar Resultados'}
                    </Button>
                    <ConfirmDialog
                      isOpen={showConfirmGravar}
                      title="Confirmar gravação"
                      message="Tem a certeza de que os dados estão corretos? Esta ação irá encerrar o jogo."
                      confirmText="OK"
                      cancelText="Cancelar"
                      variant="warning"
                      onCancel={() => setShowConfirmGravar(false)}
                      onConfirm={() => {
                        setShowConfirmGravar(false);
                        if (!gameId || !user?.id) return;
                        const createdBy = String(user.id).trim();
                        setSaving(true);
                        (async () => {
                          try {
                            for (const pair of pairs) {
                              const r = results[pair.id] ?? defaultSetRow;
                              const s1c = toNum(r.set1_casa);
                              const s1f = toNum(r.set1_fora);
                              const s2c = toNum(r.set2_casa);
                              const s2f = toNum(r.set2_fora);
                              const s3c = toNum(r.set3_casa);
                              const s3f = toNum(r.set3_fora);
                              if (s1c == null || s1f == null || s2c == null || s2f == null) continue;
                              const pairId = pair?.id && String(pair.id).trim() ? String(pair.id).trim() : null;
                              if (!pairId) continue;
                              const payload = {
                                game_id: gameId,
                                pair_id: pairId,
                                created_by: createdBy,
                                set1_casa: Number(s1c),
                                set1_fora: Number(s1f),
                                set2_casa: Number(s2c),
                                set2_fora: Number(s2f),
                                ...(s3c != null && s3f != null ? { set3_casa: Number(s3c), set3_fora: Number(s3f) } : {}),
                              };
                              await ResultsService.upsertResult(payload);
                            }
                            await GamesService.complete(gameId);
                            setGame((prev: any) => (prev ? { ...prev, status: 'concluido' } : prev));
                            showToast('Resultados guardados', 'success');
                            setResults({});
                            setSaving(false);
                            navigate({ name: 'sport-management' });
                          } catch (e) {
                            console.error('[GameDetailsScreen] Erro ao guardar:', e);
                            showToast(getErrorMessage(e), 'error');
                            setSaving(false);
                          }
                        })();
                      }}
                    />
                  </>
                )}
              </Card>
            )}
          </>
        )}

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </Layout>
  );
}
