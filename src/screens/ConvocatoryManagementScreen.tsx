import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Badge, Loading, Header, Toast, ToastType } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { GamesService, AvailabilitiesService, PairsService } from '../services';
import { Calendar, MapPin, Users, CheckCircle, Lock, ArrowLeft } from 'lucide-react';

/**
 * Gestão de Convocatórias (Opção 4)
 * Filtra jogos com status = convocatoria_aberta/open.
 * Liga: mínimo 4 jogadores (2 duplas). Outros tipos: mínimo 2 jogadores (1 dupla).
 * Ao confirmar, fecha a convocatória (status = convocatoria_fechada).
 */
export function ConvocatoryManagementScreen() {
  const { player, canManageSport } = useAuth();
  const { navigate, goBack } = useNavigation();
  const [openGames, setOpenGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [pairs, setPairs] = useState<Array<{ player1_id: string; player2_id: string }>>([
    { player1_id: '', player2_id: '' },
    { player1_id: '', player2_id: '' },
    { player1_id: '', player2_id: '' },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  useEffect(() => {
    loadOpenGames();
  }, []);

  useEffect(() => {
    if (selectedGame) {
      loadAvailablePlayers(selectedGame.id);
    } else {
      setAvailablePlayers([]);
      setSelectedPlayerIds(new Set());
      setPairs([
        { player1_id: '', player2_id: '' },
        { player1_id: '', player2_id: '' },
        { player1_id: '', player2_id: '' },
      ]);
    }
  }, [selectedGame?.id]);

  /** Liga = phase Qualificação | Regionais | Nacionais → mínimo 4 jogadores; outros → mínimo 2. */
  const isLigaGame = selectedGame && ['Qualificação', 'Regionais', 'Nacionais'].includes(String(selectedGame.phase ?? ''));
  const minPlayers = isLigaGame ? 4 : 2;
  const requiredPairs = Math.floor(minPlayers / 2);

  /**
   * Quando 2, 4 ou 6 jogadores estão selecionados, calcula automaticamente as duplas por pontos (desc).
   */
  useEffect(() => {
    const n = selectedPlayerIds.size;
    if ((n !== 2 && n !== 4 && n !== 6) || availablePlayers.length === 0) return;
    if (isLigaGame && n < 4) return;
    const ids = Array.from(selectedPlayerIds);
    const selected = ids
      .map((id) => availablePlayers.find((p: any) => p.id === id))
      .filter(Boolean) as any[];
    if (selected.length !== n) return;
    const byPoints = [...selected].sort((a, b) => (b.federation_points ?? 0) - (a.federation_points ?? 0));
    const pairCount = Math.floor(n / 2);
    const newPairs: Array<{ player1_id: string; player2_id: string }> = [];
    for (let i = 0; i < pairCount; i++) {
      newPairs.push({ player1_id: byPoints[i * 2].id, player2_id: byPoints[i * 2 + 1].id });
    }
    while (newPairs.length < 3) newPairs.push({ player1_id: '', player2_id: '' });
    setPairs(newPairs);
  }, [selectedPlayerIds, availablePlayers, isLigaGame]);

  /** Duplas ordenadas por total de pontos (maior soma → menor) para exibição e labels corretos. */
  const sortedPairsForDisplay = useMemo(() => {
    return [...pairs]
      .map((pair, idx) => {
        const p1 = availablePlayers.find((x: any) => x.id === pair.player1_id);
        const p2 = availablePlayers.find((x: any) => x.id === pair.player2_id);
        const total = (p1?.federation_points ?? 0) + (p2?.federation_points ?? 0);
        return { pair, total, p1, p2, originalIdx: idx };
      })
      .sort((a, b) => b.total - a.total);
  }, [pairs, availablePlayers]);

  const loadOpenGames = async () => {
    setLoading(true);
    try {
      const games = await GamesService.getOpenGames();
      setOpenGames(games);
      if (!selectedGame) setSelectedGame(null);
    } catch (e) {
      showToast('Erro ao carregar jogos', 'error');
      setOpenGames([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePlayers = async (gameId: string) => {
    try {
      const players = await AvailabilitiesService.getConfirmedPlayers(gameId);
      setAvailablePlayers(Array.isArray(players) ? players.filter(Boolean) : []);
    } catch (e) {
      showToast('Erro ao carregar jogadores disponíveis', 'error');
      setAvailablePlayers([]);
    }
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 6) next.add(id);
      return next;
    });
  };

  const assignPair = (pairIdx: number, slot: 'player1_id' | 'player2_id', playerId: string) => {
    setPairs((prev) => {
      const next = [...prev];
      next[pairIdx] = { ...next[pairIdx], [slot]: playerId };
      return next;
    });
  };

  const filledPairs = pairs.filter((p) => p.player1_id && p.player2_id && p.player1_id !== p.player2_id);
  const playersInPairs = new Set(filledPairs.flatMap((p) => [p.player1_id, p.player2_id]));
  const allPlayersUsed =
    selectedPlayerIds.size >= minPlayers &&
    playersInPairs.size === selectedPlayerIds.size &&
    [...selectedPlayerIds].every((id) => playersInPairs.has(id));
  const allPairsValid = filledPairs.length >= requiredPairs && allPlayersUsed;

  const handleCloseConvocatory = async () => {
    if (!selectedGame || !allPairsValid) {
      showToast(`Seleciona pelo menos ${minPlayers} jogadores e define as duplas corretamente.`, 'error');
      return;
    }

    setSaving(true);
    try {
      await PairsService.deleteByGame(selectedGame.id);
      // Gravar apenas duplas preenchidas, na ordem por total de pontos
      const orderedPairs = sortedPairsForDisplay
        .filter((ed) => ed.pair.player1_id && ed.pair.player2_id)
        .map((ed) => ({
          game_id: selectedGame.id,
          player1_id: ed.pair.player1_id,
          player2_id: ed.pair.player2_id,
        }));
      await PairsService.createMultiple(orderedPairs);
      await GamesService.closeCall(selectedGame.id);
      showToast('Convocatória fechada com sucesso', 'success');
      setSelectedGame(null);
      await loadOpenGames();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao fechar convocatória', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!canManageSport) {
    return (
      <Layout>
        <Header title="Gestão de Convocatórias" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4">
          <Card>
            <p className="text-sm text-gray-700">Acesso restrito a coordenadores e administradores.</p>
            <Button className="mt-3 inline-flex items-center justify-center gap-2" onClick={goBack}>
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </Card>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <Header title="Gestão de Convocatórias" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4">
          <Loading text="A carregar..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Gestão de Convocatórias" />
      <div className="max-w-screen-sm mx-auto px-4 pt-4 pb-24 space-y-4">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Jogos em Aberto
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Liga: mínimo 4 jogadores. Outros tipos: mínimo 2 jogadores. Escolhe quem confirmou e define as duplas. Ao
            confirmar, a convocatória é fechada.
          </p>

          {openGames.length === 0 ? (
            <div className="text-center py-6">
              <Lock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600 font-medium">Sem jogos em aberto</p>
              <p className="text-xs text-gray-500 mt-1">Cria um jogo em Gestão de Jogos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {openGames.map((game: any) => (
                <button
                  key={game.id}
                  onClick={() => setSelectedGame(selectedGame?.id === game.id ? null : game)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedGame?.id === game.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{GamesService.formatOpponentDisplay(game.opponent)}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {new Date(game.starts_at).toLocaleDateString('pt-PT')} — {game.location}
                      </span>
                    </div>
                    <Badge variant="success">Aberto</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {selectedGame && (
          <Card>
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Jogadores Disponíveis
            </h3>

            {availablePlayers.length < minPlayers ? (
              <p className="text-sm text-amber-700 mb-4">
                Apenas {availablePlayers.length} jogador(es) confirmaram presença. {isLigaGame ? 'Liga: são necessários pelo menos 4.' : 'São necessários pelo menos 2.'}
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-4">
                {isLigaGame ? 'Seleciona 4 ou 6 jogadores (clica para selecionar).' : 'Seleciona 2, 4 ou 6 jogadores (clica para selecionar).'}
              </p>
            )}

            <div className="flex flex-wrap gap-2 mb-6">
              {availablePlayers.map((p: any) => {
                const sel = selectedPlayerIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlayer(p.id)}
                    className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      sel ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {p.name} ({p.federation_points ?? 0} pts)
                  </button>
                );
              })}
            </div>

            {selectedPlayerIds.size >= minPlayers && (
              <>
                <div className="mb-6 rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
                  <h4 className="text-base font-semibold text-gray-900 mb-1">Quadro de Duplas</h4>
                  <p className="text-xs text-gray-600 mb-4">
                    Calculado automaticamente: Dupla 1 = maior soma · Dupla 2 = intermédia · Dupla 3 = menor soma
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedPairsForDisplay.filter((ed) => ed.pair.player1_id && ed.pair.player2_id).map((ed, idx) => {
                      const label =
                        idx === 0 ? 'Dupla 1 (maior soma)' : idx === 1 ? 'Dupla 2 (média)' : 'Dupla 3 (menor soma)';
                      const options = Array.from(selectedPlayerIds).map((id) =>
                        availablePlayers.find((x: any) => x.id === id)
                      ).filter(Boolean) as any[];
                      return (
                        <div
                          key={ed.originalIdx}
                          className="rounded-xl bg-white shadow-md overflow-hidden flex flex-col border border-gray-100"
                        >
                          <div className="px-4 py-3 bg-gradient-to-r from-[#1A237E] to-[#B71C1C] text-white flex items-center justify-between relative">
                            <span className="text-sm font-semibold">{label}</span>
                            <span className="absolute top-1.5 right-3 flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-white/25 px-2 text-xs font-bold text-white backdrop-blur-sm">
                              {ed.total} pts
                            </span>
                          </div>
                          <div className="p-4 space-y-3 flex-1">
                            <div className="space-y-2">
                              <select
                                aria-label="Jogador 1"
                                value={ed.pair.player1_id}
                                onChange={(e) => assignPair(ed.originalIdx, 'player1_id', e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                              >
                                <option value="">Jogador 1...</option>
                                {options.map((pl: any) => (
                                  <option key={pl.id} value={pl.id} disabled={ed.pair.player2_id === pl.id}>
                                    {pl.name} ({pl.federation_points ?? 0} pts)
                                  </option>
                                ))}
                              </select>
                              <span className="flex justify-center text-amber-600 font-medium text-xs">+</span>
                              <select
                                aria-label="Jogador 2"
                                value={ed.pair.player2_id}
                                onChange={(e) => assignPair(ed.originalIdx, 'player2_id', e.target.value)}
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                              >
                                <option value="">Jogador 2...</option>
                                {options.map((pl: any) => (
                                  <option key={pl.id} value={pl.id} disabled={ed.pair.player1_id === pl.id}>
                                    {pl.name} ({pl.federation_points ?? 0} pts)
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  fullWidth
                  onClick={handleCloseConvocatory}
                  disabled={!allPairsValid || saving}
                >
                  {saving ? 'A guardar...' : 'Fechar Convocatória'}
                </Button>
              </>
            )}

            {selectedPlayerIds.size > 0 && selectedPlayerIds.size < minPlayers && (
              <p className="text-sm text-amber-600">
                Selecionados {selectedPlayerIds.size}/{minPlayers}. Escolhe pelo menos mais {minPlayers - selectedPlayerIds.size}.
              </p>
            )}
          </Card>
        )}

        <Button variant="ghost" fullWidth onClick={() => navigate({ name: 'admin' })}>
          Voltar ao Admin
        </Button>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </Layout>
  );
}
