import { useState, useEffect, useMemo, FormEvent } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, CategoryCard, Input, Button, Badge, Loading, Header, RestrictedAccessModal, Toast, ToastType, EditGameModal } from '../components/ui';
import { CATEGORY_STYLES, getCategoryFromPhase, GRID_CLASSES } from '../domain/categoryTheme';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { GamesService, AvailabilitiesService, PairsService, PlayersService } from '../services';
import { supabase } from '../lib/supabase';
import { Plus, Calendar, Users, Lock, RefreshCw, Loader2, Pencil, AlertTriangle } from 'lucide-react';

export type GameType = 'Liga' | 'Torneio' | 'Mix' | 'Treino';

/** Subcategorias da Liga (guardadas em phase quando tipo = Liga). */
export type LigaPhase = 'Qualificação' | 'Regionais' | 'Nacionais';

const RESTRICTED_MESSAGE_SPORT =
  'Acesso Restrito: Esta área é reservada a Coordenadores e Administradores. Contacta o responsável da equipa se precisares de acesso.';

const GAME_TYPE_OPTIONS: { value: GameType; label: string }[] = [
  { value: 'Liga', label: 'Liga' },
  { value: 'Torneio', label: 'Torneio Federação' },
  { value: 'Mix', label: 'Mix' },
  { value: 'Treino', label: 'Treino' },
];

const LIGA_PHASE_OPTIONS: { value: LigaPhase; label: string }[] = [
  { value: 'Qualificação', label: 'Qualificação' },
  { value: 'Regionais', label: 'Regionais' },
  { value: 'Nacionais', label: 'Nacionais' },
];

/** Eliminatórias: valor guardado em round_number para Regionais/Nacionais. */
const ROUND_ELIMINATORIA: { value: number; label: string }[] = [
  { value: 16, label: '1/16' },
  { value: 8, label: '1/8' },
  { value: 4, label: '1/4' },
  { value: 2, label: '1/2' },
  { value: 1, label: 'Final' },
];

/**
 * Gestão de Jogos: apenas JOGOS (Criar/Abrir Convocatória).
 * phase na BD: Liga → Qualificação|Regionais|Nacionais; outros → Torneio|Mix|Treino.
 */
export function SportManagementScreen() {
  const { player, canManageSport, loading: authLoading } = useAuth();
  const { navigate, goBack } = useNavigation();
  const [gameType, setGameType] = useState<GameType>('Liga');
  const [ligaPhase, setLigaPhase] = useState<LigaPhase>('Qualificação');
  const [roundNumber, setRoundNumber] = useState('1');
  const [eliminatoriaRound, setEliminatoriaRound] = useState(16);
  const [gameDate, setGameDate] = useState('');
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [gameError, setGameError] = useState('');

  // Gestão de Convocatórias (integrada)
  const [openGames, setOpenGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const [pairs, setPairs] = useState<Array<{ player1_id: string; player2_id: string }>>([
    { player1_id: '', player2_id: '' },
    { player1_id: '', player2_id: '' },
    { player1_id: '', player2_id: '' },
  ]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Substituição de emergência (convocatória já fechada)
  const [closedGames, setClosedGames] = useState<any[]>([]);
  const [selectedGameForSwap, setSelectedGameForSwap] = useState<any | null>(null);
  const [savedPairs, setSavedPairs] = useState<any[]>([]);
  /** Query bruta: única fonte para os dropdowns. Apenas tabela players, is_active = true — sem filtros. */
  const [rawPlayers, setRawPlayers] = useState<any[]>([]);
  /** Duplas em edição (permite seleção livre; só valida e grava ao clicar em Confirmar e Gravar Duplas). */
  const [editablePairsForSwap, setEditablePairsForSwap] = useState<Array<{ id: string; player1_id: string; player2_id: string; pair_order?: number }>>([]);
  /** IDs dos jogadores que confirmaram presença neste jogo (para cor verde/vermelho no dropdown). */
  const [confirmedPlayerIdsForGame, setConfirmedPlayerIdsForGame] = useState<Set<string>>(new Set());
  const [swapLoading, setSwapLoading] = useState(false);
  const [closedGamesLoading, setClosedGamesLoading] = useState(false);
  const [gameEditOpponent, setGameEditOpponent] = useState('');
  const [gameEditLocation, setGameEditLocation] = useState('');
  const [gameEditSaving, setGameEditSaving] = useState(false);
  const [gameToEdit, setGameToEdit] = useState<any | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  useEffect(() => {
    if (canManageSport) {
      loadOpenGames();
      loadClosedGames();
    }
  }, [canManageSport]);

  useEffect(() => {
    if (selectedGameForSwap) {
      setGameEditOpponent(selectedGameForSwap.opponent ?? '');
      setGameEditLocation(selectedGameForSwap.location ?? '');
      loadSavedPairs(selectedGameForSwap.id);
      loadConfirmedPlayerIdsForGame(selectedGameForSwap.id);
      (async () => {
        const { data: raw } = await supabase
          .from('players')
          .select('id, name, federation_points, is_active')
          .eq('is_active', true);
        setRawPlayers(Array.isArray(raw) ? raw : []);
      })();
    } else {
      setSavedPairs([]);
      setRawPlayers([]);
      setConfirmedPlayerIdsForGame(new Set());
    }
  }, [selectedGameForSwap?.id]);

  useEffect(() => {
    if (selectedGameForSwap && savedPairs.length > 0) {
      setEditablePairsForSwap(
        savedPairs.map((p: any) => ({
          id: p.id,
          player1_id: p.player1_id,
          player2_id: p.player2_id,
          pair_order: p.pair_order,
        }))
      );
    } else {
      setEditablePairsForSwap([]);
    }
  }, [selectedGameForSwap?.id, savedPairs]);

  const updateEditablePairSlot = (pairId: string, slot: 'player1_id' | 'player2_id', playerId: string) => {
    setEditablePairsForSwap((prev) =>
      prev.map((p) => (p.id === pairId ? { ...p, [slot]: playerId } : p))
    );
  };

  const hasPendingSwapChanges = (): boolean => {
    if (editablePairsForSwap.length !== savedPairs.length) return false;
    const saved = new Map(savedPairs.map((p: any) => [p.id, { player1_id: p.player1_id, player2_id: p.player2_id }]));
    return editablePairsForSwap.some(
      (ed) => saved.get(ed.id)?.player1_id !== ed.player1_id || saved.get(ed.id)?.player2_id !== ed.player2_id
    );
  };

  const sortedPairsForDisplay = useMemo(() => {
    if (!editablePairsForSwap?.length || !rawPlayers?.length) return [];
    return [...editablePairsForSwap]
      .map((ed) => {
        const p1 = rawPlayers.find((pl: any) => pl.id === ed.player1_id);
        const p2 = rawPlayers.find((pl: any) => pl.id === ed.player2_id);
        const total = (p1?.federation_points ?? 0) + (p2?.federation_points ?? 0);
        return { ...ed, total, p1, p2 };
      })
      .sort((a, b) => b.total - a.total);
  }, [editablePairsForSwap, rawPlayers]);

  const duplicatePlayerIds = useMemo(() => {
    const allIds = editablePairsForSwap.flatMap((p) => [p.player1_id, p.player2_id]).filter(Boolean);
    const seen = new Map<string, number>();
    for (const id of allIds) seen.set(id, (seen.get(id) ?? 0) + 1);
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([id]) => id));
  }, [editablePairsForSwap]);

  const hasDuplicatePlayers = duplicatePlayerIds.size > 0;

  const handleConfirmSubstitutions = async () => {
    if (!selectedGameForSwap || swapLoading) return;
    const allIds = editablePairsForSwap.flatMap((p) => [p.player1_id, p.player2_id]).filter(Boolean);
    const seen = new Map<string, number>();
    for (const id of allIds) {
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
    const duplicateId = [...seen.entries()].find(([, count]) => count > 1)?.[0];
    if (duplicateId) {
      const name = rawPlayers.find((p: any) => p.id === duplicateId)?.name ?? 'Desconhecido';
      showToast(
        `⚠️ Erro: O jogador [${name}] está selecionado em mais do que uma dupla. Por favor, corrige antes de gravar.`,
        'error'
      );
      return;
    }
    setSwapLoading(true);
    try {
      const savedMap = new Map(savedPairs.map((p: any) => [p.id, p]));
      for (const ed of editablePairsForSwap) {
        const saved = savedMap.get(ed.id);
        if (!saved || saved.player1_id !== ed.player1_id || saved.player2_id !== ed.player2_id) {
          await PairsService.update(ed.id, { player1_id: ed.player1_id, player2_id: ed.player2_id });
        }
      }
      showToast('Substituições guardadas. A ordem das duplas foi atualizada.', 'success');
      await loadSavedPairs(selectedGameForSwap.id);
      await loadClosedGames();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao guardar substituições', 'error');
    } finally {
      setSwapLoading(false);
    }
  };

  const handleSaveGameDetails = async () => {
    if (!selectedGameForSwap || gameEditSaving) return;
    setGameEditSaving(true);
    try {
      await GamesService.update(selectedGameForSwap.id, {
        opponent: gameEditOpponent.trim() || selectedGameForSwap.opponent,
        location: gameEditLocation.trim() || selectedGameForSwap.location,
      });
      setSelectedGameForSwap((prev) =>
        prev
          ? {
              ...prev,
              opponent: gameEditOpponent.trim() || prev.opponent,
              location: gameEditLocation.trim() || prev.location,
            }
          : null
      );
      await loadClosedGames();
      showToast('Adversário e local atualizados', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao guardar', 'error');
    } finally {
      setGameEditSaving(false);
    }
  };

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

  /** Duplas ordenadas por total de pontos (maior soma → menor) para exibição no Quadro de Duplas. */
  const sortedConvocatoryPairs = useMemo(() => {
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
    setGamesLoading(true);
    try {
      const games = await GamesService.getOpenGames(true);
      setOpenGames(games);
      if (!selectedGame) setSelectedGame(null);
    } catch (e) {
      showToast('Erro ao carregar jogos', 'error');
      setOpenGames([]);
    } finally {
      setGamesLoading(false);
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

  const loadClosedGames = async () => {
    setClosedGamesLoading(true);
    try {
      const games = await GamesService.getByStatus('convocatoria_fechada');
      setClosedGames(Array.isArray(games) ? games : []);
    } catch (e) {
      showToast('Erro ao carregar jogos fechados', 'error');
      setClosedGames([]);
    } finally {
      setClosedGamesLoading(false);
    }
  };

  const loadSavedPairs = async (gameId: string) => {
    try {
      const data = await PairsService.getByGame(gameId);
      setSavedPairs(Array.isArray(data) ? data : []);
    } catch (e) {
      showToast('Erro ao carregar duplas', 'error');
      setSavedPairs([]);
    }
  };

  /** Carrega os player_id que têm status = confirmed para este jogo — usado só para cor verde/vermelho no dropdown. */
  const loadConfirmedPlayerIdsForGame = async (gameId: string) => {
    try {
      const { data, error } = await supabase
        .from('availabilities')
        .select('player_id')
        .eq('game_id', gameId)
        .in('status', ['confirmed']);
      if (error) throw error;
      const ids = new Set((data ?? []).map((r: any) => r.player_id).filter(Boolean));
      setConfirmedPlayerIdsForGame(ids);
    } catch {
      setConfirmedPlayerIdsForGame(new Set());
    }
  };

  const handleSwapPlayer = async (
    pairId: string,
    slot: 'player1_id' | 'player2_id',
    newPlayerId: string
  ) => {
    if (!selectedGameForSwap || swapLoading) return;
    setSwapLoading(true);
    try {
      await PairsService.update(pairId, { [slot]: newPlayerId });
      showToast('Jogador substituído. A ordem das duplas foi atualizada.', 'success');
      await loadSavedPairs(selectedGameForSwap.id);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao trocar jogador', 'error');
    } finally {
      setSwapLoading(false);
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
      try {
        await PairsService.deleteByGame(selectedGame.id);
      } catch (deleteErr) {
        console.warn('[Fechar Convocatória] deleteByGame (ignorado se vazio):', deleteErr);
      }

      const gameId = selectedGame.id;
      // Gravar apenas duplas preenchidas, na ordem por total de pontos (maior soma primeiro)
      const dadosParaEnviar = sortedConvocatoryPairs
        .filter((ed) => ed.pair.player1_id && ed.pair.player2_id)
        .map((ed) => ({
          game_id: gameId,
          player1_id: ed.pair.player1_id,
          player2_id: ed.pair.player2_id,
        }));

      try {
        await PairsService.createMultiple(dadosParaEnviar);
      } catch (insertErr: unknown) {
        console.error("[Fechar Convocatória] createMultiple falhou:", insertErr);
        const err = insertErr as { status?: number; code?: string; message?: string };
        const msg = err?.message ?? (insertErr instanceof Error ? insertErr.message : String(insertErr));
        showToast(`Erro ao gravar duplas (${err?.status ?? "?"}/${err?.code ?? "?"}): ${msg}`, 'error');
        setSaving(false);
        return;
      }
      try {
        await GamesService.closeCall(selectedGame.id);
      } catch (closeErr) {
        showToast(closeErr instanceof Error ? closeErr.message : 'Convocatória fechada mas falha ao atualizar jogo', 'error');
        setSaving(false);
        return;
      }
      showToast('Convocatória fechada com sucesso', 'success');
      setSelectedGame(null);
      await loadOpenGames();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao fechar convocatória';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGame = async (e: FormEvent) => {
    e.preventDefault();
    setGameError('');
    if (authLoading) return;
    if (!player?.id) {
      setGameError('Perfil ainda a carregar ou não encontrado. Espera ou faz logout e login.');
      return;
    }

    setLoading(true);
    try {
      let finalRoundNumber: number;
      let phase: string;
      if (gameType === 'Treino') {
        finalRoundNumber = 0;
        phase = 'Treino';
      } else if (gameType === 'Torneio') {
        finalRoundNumber = 999;
        phase = 'Torneio';
      } else if (gameType === 'Mix') {
        finalRoundNumber = 0;
        phase = 'Mix';
      } else {
        phase = ligaPhase;
        finalRoundNumber = ligaPhase === 'Qualificação' ? (parseInt(roundNumber, 10) || 1) : eliminatoriaRound;
      }

      const gameData = {
        round_number: finalRoundNumber,
        game_date: gameDate ? new Date(gameDate).toISOString() : new Date().toISOString(),
        opponent,
        location,
        phase,
        team_id: player.team_id ?? null,
        created_by: player.id,
      };
      const game = await GamesService.create(gameData);

      await GamesService.openCall(game.id);

      setGameType('Liga');
      setLigaPhase('Qualificação');
      setRoundNumber('1');
      setEliminatoriaRound(16);
      setGameDate('');
      setOpponent('');
      setLocation('');

      navigate({ name: 'game', params: { id: game.id } });
    } catch (err: unknown) {
      let errorMessage = 'Erro ao criar jogo';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
        errorMessage = (err as { message: string }).message;
      }
      setGameError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!canManageSport) {
    return (
      <Layout>
        <Header title="Gestão de Jogos" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4">
          <RestrictedAccessModal
            isOpen
            message={RESTRICTED_MESSAGE_SPORT}
            onClose={goBack}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Gestão de Jogos" />
      <div className="max-w-screen-lg mx-auto px-4 pt-4 pb-6 space-y-6">
        <CategoryCard
          category={gameType}
          header={
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Criar Jogo e Abrir Convocatória
            </h2>
          }
        >
          <p className="text-sm text-gray-600 mb-4">
            Cria um novo jogo e abre a convocatória. Depois pode definir duplas e resultados no ecrã do jogo.
          </p>

          <form onSubmit={handleCreateGame} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de jogo</label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value as GameType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {GAME_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {gameType === 'Liga' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Liga de Clubes</label>
                  <select
                    value={ligaPhase}
                    onChange={(e) => setLigaPhase(e.target.value as LigaPhase)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {LIGA_PHASE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {ligaPhase === 'Qualificação' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jornada</label>
                    <select
                      value={roundNumber}
                      onChange={(e) => setRoundNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num.toString()}>
                          Jornada {num}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {(ligaPhase === 'Regionais' || ligaPhase === 'Nacionais') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Eliminatória</label>
                    <select
                      value={eliminatoriaRound}
                      onChange={(e) => setEliminatoriaRound(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {ROUND_ELIMINATORIA.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <Input
              type="datetime-local"
              label="Data e Hora"
              value={gameDate}
              onChange={(e) => setGameDate(e.target.value)}
              required
            />

            <Input
              type="text"
              label="Adversário"
              placeholder="Nome da equipa adversária"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              required
            />

            <Input
              type="text"
              label="Local"
              placeholder="Clube ou pavilhão"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              required
            />

            {gameError && <p className="text-sm text-red-600">{gameError}</p>}

            <Button
              type="submit"
              fullWidth
              disabled={loading || authLoading}
              className={CATEGORY_STYLES[gameType].buttonClasses}
            >
              {authLoading ? 'A carregar perfil...' : loading ? 'A criar...' : 'Criar e Abrir Convocatória'}
            </Button>
          </form>
        </CategoryCard>

        {/* Gestão de Convocatórias - Jogos em Aberto */}
        <CategoryCard
          category="Liga"
          header={
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Jogos em Aberto
            </h2>
          }
        >
          <p className="text-sm text-gray-600 mb-4">
            Liga: mínimo 4 jogadores (2 duplas). Outros tipos: mínimo 2 jogadores (1 dupla). Escolhe da lista de{' '}
            <strong>confirmados</strong>; as duplas são ordenadas por pontos. Ao confirmar, a convocatória é fechada.
            Jogos com data já passada continuam aqui até serem concluídos ou fechados — usa o ícone de lápis para adiar ou alterar o local.
          </p>

          {gamesLoading ? (
            <Loading text="A carregar..." />
          ) : openGames.length === 0 ? (
            <div className="text-center py-6">
              <Lock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600 font-medium">Sem jogos em aberto</p>
              <p className="text-xs text-gray-500 mt-1">Cria um jogo acima para abrir convocatória</p>
            </div>
          ) : (
            <div className={GRID_CLASSES}>
              {openGames.map((game: any) => {
                const cat = getCategoryFromPhase(game.phase);
                const styles = CATEGORY_STYLES[cat];
                const isPastDate = new Date(game.starts_at) < new Date();
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => setSelectedGame(selectedGame?.id === game.id ? null : game)}
                    className={`relative text-left rounded-xl overflow-hidden shadow-lg border-2 transition-all ${
                      selectedGame?.id === game.id ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500' : isPastDate ? 'border-amber-400 bg-amber-50/30 hover:shadow-xl' : 'border-transparent hover:shadow-xl'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGameToEdit(game);
                      }}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-white/90 hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors shadow-sm"
                      aria-label="Editar jogo"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isPastDate && (
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                        Data passada
                      </div>
                    )}
                    <div className={`px-3 py-2 ${styles.headerGradient} text-white text-sm font-semibold`}>
                      {GamesService.formatOpponentDisplay(game.opponent)}
                    </div>
                    <div className="p-3 bg-white">
                      <span className="text-xs text-gray-600">
                        {new Date(game.starts_at).toLocaleDateString('pt-PT')} — {game.location}
                      </span>
                      <Badge variant="success" className="mt-2">Aberto</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedGame && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Jogadores confirmados (status = confirmed)
              </h3>

              {availablePlayers.length < minPlayers ? (
                <p className="text-sm text-amber-700 mb-4">
                  Apenas {availablePlayers.length} jogador(es) confirmaram presença. {isLigaGame ? 'Liga: são necessários pelo menos 4.' : 'São necessários pelo menos 2.'}
                </p>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  {isLigaGame ? 'Seleciona 4 ou 6 jogadores (clica para selecionar).' : 'Seleciona 2, 4 ou 6 jogadores (clica para selecionar).'} As duplas são calculadas automaticamente por pontos.
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
                  <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 mb-6">
                    <h4 className="text-base font-semibold text-gray-900 mb-1">Quadro de Duplas</h4>
                    <p className="text-xs text-gray-600 mb-4">
                      Calculado automaticamente: Dupla 1 = maior soma · Dupla 2 = intermédia · Dupla 3 = menor soma
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {sortedConvocatoryPairs.filter((ed) => ed.pair.player1_id && ed.pair.player2_id).map((ed, idx) => {
                        const label =
                          idx === 0 ? 'Dupla 1 (maior soma)' : idx === 1 ? 'Dupla 2 (média)' : 'Dupla 3 (menor soma)';
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
                                  {Array.from(selectedPlayerIds).map((id) => {
                                    const pl = availablePlayers.find((x: any) => x.id === id);
                                    return (
                                      <option key={id} value={id} disabled={ed.pair.player2_id === id}>
                                        {pl?.name} ({pl?.federation_points ?? 0} pts)
                                      </option>
                                    );
                                  })}
                                </select>
                                <span className="flex justify-center text-amber-600 font-medium text-xs">+</span>
                                <select
                                  aria-label="Jogador 2"
                                  value={ed.pair.player2_id}
                                  onChange={(e) => assignPair(ed.originalIdx, 'player2_id', e.target.value)}
                                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                  <option value="">Jogador 2...</option>
                                  {Array.from(selectedPlayerIds).map((id) => {
                                    const pl = availablePlayers.find((x: any) => x.id === id);
                                    return (
                                      <option key={id} value={id} disabled={ed.pair.player1_id === id}>
                                        {pl?.name} ({pl?.federation_points ?? 0} pts)
                                      </option>
                                    );
                                  })}
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
                    disabled={!allPairsValid || !allPlayersUsed || saving}
                  >
                    {saving ? 'A guardar...' : 'Fechar Convocatória'}
                  </Button>
                </>
              )}

              {selectedPlayerIds.size > 0 && selectedPlayerIds.size < minPlayers && (
                <p className="text-sm text-amber-600">
                  Selecionados {selectedPlayerIds.size}/{minPlayers}. {isLigaGame ? 'Liga: escolhe pelo menos mais ' + (minPlayers - selectedPlayerIds.size) + '.' : 'Escolhe pelo menos mais ' + (minPlayers - selectedPlayerIds.size) + '.'}
                </p>
              )}
            </div>
          )}
        </CategoryCard>

        {/* Substituição de emergência — trocar jogador em duplas (convocatória já fechada) */}
        <CategoryCard
          category="Treino"
          header={
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Substituição de emergência
            </h2>
          }
        >
          <p className="text-sm text-gray-600 mb-4">
            Troca um jogador de uma dupla mesmo com convocatória fechada. Podes escolher <strong>qualquer jogador ativo do clube</strong> (não depende da convocatória). A ordem das duplas é atualizada automaticamente. Não é possível colocar o mesmo jogador em duas duplas.
          </p>

          {closedGamesLoading ? (
            <Loading text="A carregar jogos..." />
          ) : closedGames.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum jogo com convocatória fechada.</p>
          ) : (
            <div className={GRID_CLASSES + ' mb-4'}>
              {closedGames.map((game: any) => {
                const cat = getCategoryFromPhase(game.phase);
                const styles = CATEGORY_STYLES[cat];
                const isPastDate = new Date(game.starts_at) < new Date();
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => setSelectedGameForSwap(selectedGameForSwap?.id === game.id ? null : game)}
                    className={`relative text-left rounded-xl overflow-hidden shadow-lg border-2 transition-all ${
                      selectedGameForSwap?.id === game.id ? 'ring-2 ring-offset-2 ring-amber-500 border-amber-500' : isPastDate ? 'border-amber-400 bg-amber-50/30 hover:shadow-xl' : 'border-transparent hover:shadow-xl'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setGameToEdit(game);
                      }}
                      className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-white/90 hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors shadow-sm"
                      aria-label="Editar jogo"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isPastDate && (
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                        Data passada
                      </div>
                    )}
                    <div className={`px-3 py-2 ${styles.headerGradient} text-white text-sm font-semibold`}>
                      {GamesService.formatOpponentDisplay(game.opponent)}
                    </div>
                    <div className="p-3 bg-white">
                      <span className="text-xs text-gray-600">
                        {new Date(game.starts_at).toLocaleDateString('pt-PT')} — {game.location}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {selectedGameForSwap && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Editar jogo</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Adversário</label>
                    <input
                      type="text"
                      value={gameEditOpponent}
                      onChange={(e) => setGameEditOpponent(e.target.value)}
                      placeholder="Nome da equipa adversária"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Local</label>
                    <input
                      type="text"
                      value={gameEditLocation}
                      onChange={(e) => setGameEditLocation(e.target.value)}
                      placeholder="Clube ou pavilhão"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSaveGameDetails}
                    disabled={gameEditSaving}
                    className="w-full"
                  >
                    {gameEditSaving ? 'A guardar...' : 'Guardar adversário e local'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {selectedGameForSwap && editablePairsForSwap.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Duplas — dashboard</h3>
              <p className="text-xs text-gray-500 mb-4">
                Ranking dinâmico: as duplas reordenam-se por pontos. ✅ Confirmado · ⚠️ Suplente
              </p>
              {swapLoading && <Loading text="A atualizar..." />}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedPairsForDisplay.map((ed, idx) => {
                  const options = rawPlayers;
                  const rankLabel = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª'][idx] ?? `${idx + 1}ª`;
                  const label = `${rankLabel} Dupla`;
                  const total = ed.total;
                  return (
                    <div
                      key={ed.id}
                      className="rounded-xl bg-white shadow-md overflow-hidden flex flex-col border border-gray-100 relative"
                    >
                      <div className="px-4 py-3 bg-gradient-to-r from-[#1A237E] to-[#B71C1C] text-white flex items-center justify-between relative">
                        <span className="text-sm font-semibold">{label}</span>
                        <span className="absolute top-1.5 right-3 flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-white/25 px-2 text-xs font-bold text-white backdrop-blur-sm">
                          {total} pts
                        </span>
                      </div>
                      <div className="p-4 space-y-3 flex-1">
                        <div className="space-y-2">
                          <select
                            aria-label="Jogador 1"
                            className={`w-full text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                              duplicatePlayerIds.has(ed.player1_id) ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
                            }`}
                            disabled={swapLoading || options.length === 0}
                            value={ed.player1_id}
                            onChange={(e) => updateEditablePairSlot(ed.id, 'player1_id', e.target.value)}
                          >
                            {options.map((pl: any) => {
                              const confirmed = confirmedPlayerIdsForGame.has(pl.id);
                              const prefix = confirmed ? '✅ ' : '⚠️ ';
                              const suffix = confirmed ? ' (Confirmado)' : ' (Suplente)';
                              return (
                                <option key={pl.id} value={pl.id} style={{ color: confirmed ? '#15803d' : '#dc2626' }}>
                                  {prefix}{pl.name} ({pl.federation_points ?? 0} pts){suffix}
                                </option>
                              );
                            })}
                          </select>
                          <span className="flex justify-center text-amber-600 font-medium text-xs">+</span>
                          <select
                            aria-label="Jogador 2"
                            className={`w-full text-sm border rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                              duplicatePlayerIds.has(ed.player2_id) ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-300'
                            }`}
                            disabled={swapLoading || options.length === 0}
                            value={ed.player2_id}
                            onChange={(e) => updateEditablePairSlot(ed.id, 'player2_id', e.target.value)}
                          >
                            {options.map((pl: any) => {
                              const confirmed = confirmedPlayerIdsForGame.has(pl.id);
                              const prefix = confirmed ? '✅ ' : '⚠️ ';
                              const suffix = confirmed ? ' (Confirmado)' : ' (Suplente)';
                              return (
                                <option key={pl.id} value={pl.id} style={{ color: confirmed ? '#15803d' : '#dc2626' }}>
                                  {prefix}{pl.name} ({pl.federation_points ?? 0} pts){suffix}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="sticky bottom-0 left-0 right-0 mt-6 pt-4 pb-2 -mx-4 px-4 bg-gradient-to-t from-white via-white to-transparent">
                <Button
                  className={`w-full font-semibold py-3.5 text-base border-0 focus:ring-2 focus:ring-offset-2 ${CATEGORY_STYLES[selectedGameForSwap ? getCategoryFromPhase(selectedGameForSwap.phase) : 'Treino'].buttonClasses}`}
                  variant="primary"
                  onClick={handleConfirmSubstitutions}
                  disabled={swapLoading || hasDuplicatePlayers || !hasPendingSwapChanges()}
                >
                  {swapLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2 inline" aria-hidden />
                      A gravar...
                    </>
                  ) : (
                    'Gravar Alterações'
                  )}
                </Button>
              </div>
            </div>
          )}

          {selectedGameForSwap && savedPairs.length === 0 && !closedGamesLoading && (
            <p className="text-sm text-gray-500 mt-4">Este jogo ainda não tem duplas definidas.</p>
          )}
        </CategoryCard>

        <EditGameModal
          isOpen={!!gameToEdit}
          game={gameToEdit}
          onClose={() => setGameToEdit(null)}
          onSuccess={async () => {
            await loadOpenGames();
            await loadClosedGames();
            showToast('Jogo atualizado com sucesso', 'success');
            setGameToEdit(null);
          }}
        />

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </Layout>
  );
}
