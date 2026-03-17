import { useState, useEffect, useLayoutEffect, useMemo, useRef, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card, CategoryCard, Input, Button, Badge, Loading, Header, RestrictedAccessModal, Toast, ToastType, EditGameModal, ConfirmDialog } from '../components/ui';
import { CATEGORY_STYLES, getCategoryFromPhase, GRID_CLASSES } from '../domain/categoryTheme';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { PlayerRoles } from '../domain/constants';
import { GamesService, AvailabilitiesService, PairsService, PlayersService, ResultsService, getPlayerRanking, getTeamPerformanceStats, getSeasonStats, syncPlayerPoints } from '../services';
import type { PlayerRankingRow, TeamPerformanceStats, SeasonStatRow, SeasonStatsCategory } from '../services';
import { supabase } from '../lib/supabase';
import { GESTOR_HIDE_EMAIL } from '../lib/gestorFilter';
import { Plus, Calendar, Users, Lock, RefreshCw, Loader2, Pencil, AlertTriangle, Medal, Trophy, BarChart2, UserCheck, MessageCircle, Trash2, Check, Circle, TrendingUp, Settings, ClipboardList, ClipboardCheck } from 'lucide-react';
import { buildWhatsAppShareUrl, buildWhatsAppConvocationUrl, buildWhatsAppDuplaConvocationUrl, buildGoogleCalendarUrl, getAppGameUrl } from '../lib/shareLinks';
import type { GameShareInfo } from '../lib/shareLinks';
import { sendConvocationEmail } from '../services/emailService';

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
const OWNER_EMAIL = 'jco.simoes@gmail.com';
const DEAD_TEAM_ID = '75782791-729c-4863-95c5-927690656a81';
const isOwnerEmail = (email: string | null | undefined) =>
  (email ?? '').trim().toLowerCase() === OWNER_EMAIL;

export function SportManagementScreen() {
  const { player, user, canManageSport, role, loading: authLoading } = useAuth();
  const isHardcodedAdmin = role === PlayerRoles.admin;
  /** Bypass total para jco.simoes@gmail.com: ignora team_id e role; acesso total ao ecrã e ao botão de criar convocatória. */
  const isOwner = isOwnerEmail(user?.email);
  const canManage = isOwner || role === PlayerRoles.admin || canManageSport;
  /** Dono ou team_id antigo (75782791...): nunca usar — evita 404. Mostra sempre o ecrã e o botão Criar Jogo. */
  const rawTeamId = player?.team_id ?? (isHardcodedAdmin ? undefined : undefined);
  const effectiveTeamId = isOwner || rawTeamId === DEAD_TEAM_ID ? undefined : rawTeamId;
  const { navigate, goBack } = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [gameToDelete, setGameToDelete] = useState<any | null>(null);
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null);
  /** Após fechar convocatória: mostra botão "Partilhar via WhatsApp" (opção secundária ou quando o email falha). */
  const [convocationShareInfo, setConvocationShareInfo] = useState<{ gameInfo: GameShareInfo; hadEmailFailures: boolean } | null>(null);
  /** Jogadores a quem o Admin já clicou "Enviar Convocatória via WhatsApp" neste jogo (evita duplicações visuais). */
  const [sentConvocationWhatsAppIds, setSentConvocationWhatsAppIds] = useState<Set<string>>(new Set());

  // Registo de Resultado (jogos com duplas fechadas ou data passada)
  const [selectedGameForResult, setSelectedGameForResult] = useState<any | null>(null);
  const [resultPairs, setResultPairs] = useState<any[]>([]);
  const [resultFormResults, setResultFormResults] = useState<Record<string, { set1_casa: number; set1_fora: number; set2_casa: number; set2_fora: number; set3_casa: number | null; set3_fora: number | null }>>({});
  const [resultFormSaving, setResultFormSaving] = useState(false);
  const [resultFormConfirmOpen, setResultFormConfirmOpen] = useState(false);
  const [resultFormLoading, setResultFormLoading] = useState(false);

  const hasRestoredConvocationRef = useRef(false);
  const CONVOCATION_STORAGE_KEY = 'liga-convocation-state';
  const TAB_STORAGE_KEY = 'liga-gestao-active-tab';

  // Dashboard de Performance (Coordenador: equipa + ranking com % disponibilidade)
  const [teamStats, setTeamStats] = useState<TeamPerformanceStats | null>(null);
  const [ranking, setRanking] = useState<PlayerRankingRow[]>([]);
  const [seasonStatsEpoca, setSeasonStatsEpoca] = useState<SeasonStatRow[]>([]);
  const [seasonStatsMes, setSeasonStatsMes] = useState<SeasonStatRow[]>([]);
  const [totalGamesEpoca, setTotalGamesEpoca] = useState(0);
  const [totalGamesMes, setTotalGamesMes] = useState(0);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [rankingSortBy, setRankingSortBy] = useState<'total' | 'liga' | 'federacao' | 'conv' | 'disp'>('total');
  const [rankingSortAsc, setRankingSortAsc] = useState(false);
  /** Filtro de categoria para o ranking: Geral, Liga ou Treinos (pontos, Conv. e % Disp. por categoria). */
  const [rankingCategoryFilter, setRankingCategoryFilter] = useState<SeasonStatsCategory>('Geral');
  const [rankingCategoryStats, setRankingCategoryStats] = useState<SeasonStatRow[] | null>(null);
  const [rankingCategoryTotalGames, setRankingCategoryTotalGames] = useState(0);
  /** Ranking filtrado por categoria (Liga = pontos só de jogos Liga; Treino = 0 pts). Null quando Geral. */
  const [rankingByCategory, setRankingByCategory] = useState<PlayerRankingRow[] | null>(null);
  const [rankingCategoryLoading, setRankingCategoryLoading] = useState(false);

  // Tabs: Performance | Gestão Técnica | Convocatórias (estado inicial a partir de localStorage para preservar ao voltar do WhatsApp)
  const [activeTab, setActiveTabState] = useState<'performance' | 'tecnica' | 'convocatorias'>(() => {
    if (typeof window === 'undefined') return 'performance';
    try {
      const t = localStorage.getItem('liga-gestao-active-tab');
      if (t === 'tecnica' || t === 'convocatorias' || t === 'performance') return t;
    } catch (_) {}
    return 'performance';
  });
  const setActiveTab = (tab: 'performance' | 'tecnica' | 'convocatorias') => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('liga-gestao-active-tab', tab);
      setSearchParams({ tab }, { replace: true });
    } catch (_) {}
  };
  const [seasonStatsSortBy, setSeasonStatsSortBy] = useState<'disponibilidade' | 'pontos_liga'>('disponibilidade');
  const [seasonStatsSortAsc, setSeasonStatsSortAsc] = useState(false);
  const [statsFilter, setStatsFilter] = useState<'epoca' | 'mes'>('epoca');
  const [recalculatingPoints, setRecalculatingPoints] = useState(false);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  const handleRecalcularPontos = async () => {
    if (recalculatingPoints || !effectiveTeamId) return;
    setRecalculatingPoints(true);
    try {
      const { updated, errors } = await syncPlayerPoints(effectiveTeamId);
      if (errors.length > 0) {
        showToast(`Atualizados: ${updated}. Erros: ${errors.slice(0, 2).join('; ')}`, 'error');
      } else {
        showToast(`Pontos recalculados: ${updated} jogador(es).`, 'success');
      }
      await loadDashboard();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao recalcular pontos.', 'error');
    } finally {
      setRecalculatingPoints(false);
    }
  };

  const loadDashboard = async () => {
    const tid = effectiveTeamId;
    setDashboardLoading(true);
    if (!tid || !canManageSport) {
      setRanking([]);
      setTeamStats(null);
      setSeasonStatsEpoca([]);
      setSeasonStatsMes([]);
      setTotalGamesEpoca(0);
      setTotalGamesMes(0);
      setDashboardLoading(false);
      return;
    }
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    try {
      const [rankData, teamData, seasonEpoca, seasonMes] = await Promise.all([
        getPlayerRanking(tid),
        getTeamPerformanceStats(tid),
        getSeasonStats(tid),
        getSeasonStats(tid, { startDate: thirtyDaysAgo, endDate: now }),
      ]);
      setRanking(Array.isArray(rankData) ? rankData : []);
      setTeamStats(teamData ?? null);
      setSeasonStatsEpoca(Array.isArray(seasonEpoca?.rows) ? seasonEpoca.rows : []);
      setSeasonStatsMes(Array.isArray(seasonMes?.rows) ? seasonMes.rows : []);
      setTotalGamesEpoca(seasonEpoca?.totalGamesInPeriod ?? 0);
      setTotalGamesMes(seasonMes?.totalGamesInPeriod ?? 0);
    } catch {
      setRanking([]);
      setTeamStats(null);
      setSeasonStatsEpoca([]);
      setSeasonStatsMes([]);
      setTotalGamesEpoca(0);
      setTotalGamesMes(0);
    } finally {
      setDashboardLoading(false);
    }
  };

  // Carregar jogos/dashboard só ao entrar na gestão. Não refazer quando player/team_id muda (ex.: sync de outro separador)
  // para não resetar o ecrã de Convocatória Aberta enquanto o Admin envia notificações WhatsApp.
  useEffect(() => {
    if (canManageSport) {
      loadOpenGames();
      loadClosedGames();
      loadDashboard();
    }
  }, [canManageSport]);

  /** Carrega ranking + estatísticas por categoria quando o filtro é Liga ou Treinos. */
  useEffect(() => {
    const category = rankingCategoryFilter || 'Geral';
    if (category === 'Geral' || !effectiveTeamId) {
      setRankingCategoryStats(null);
      setRankingCategoryTotalGames(0);
      setRankingByCategory(null);
      return;
    }
    let cancelled = false;
    setRankingCategoryLoading(true);
    const tid = effectiveTeamId;
    Promise.all([
      getSeasonStats(tid, { category: category || 'Geral' }),
      getPlayerRanking(tid, { category: category || 'Geral' }),
    ])
      .then(([statsRes, rankingRows]) => {
        if (cancelled) return;
        setRankingCategoryStats(statsRes.rows);
        setRankingCategoryTotalGames(statsRes.totalGamesInPeriod);
        setRankingByCategory(rankingRows);
      })
      .catch(() => {
        if (!cancelled) {
          setRankingCategoryStats([]);
          setRankingCategoryTotalGames(0);
          setRankingByCategory([]);
        }
      })
      .finally(() => {
        if (!cancelled) setRankingCategoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [rankingCategoryFilter, effectiveTeamId]);

  useEffect(() => {
    if (selectedGameForSwap) {
      setGameEditOpponent(selectedGameForSwap.opponent ?? '');
      setGameEditLocation(selectedGameForSwap.location ?? '');
      loadSavedPairs(selectedGameForSwap.id);
      loadConfirmedPlayerIdsForGame(selectedGameForSwap.id);
      (async () => {
        const { data: raw } = await supabase
          .from('players')
          .select('id, name, federation_points, liga_points, is_active')
          .eq('is_active', true)
          .neq('email', GESTOR_HIDE_EMAIL);
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

  const totalRawPlayerPoints = (pl: any) => (pl?.liga_points ?? 0) + (pl?.federation_points ?? 0);
  const sortedPairsForDisplay = useMemo(() => {
    if (!editablePairsForSwap?.length || !rawPlayers?.length) return [];
    return [...editablePairsForSwap]
      .map((ed) => {
        const p1 = rawPlayers.find((pl: any) => pl.id === ed.player1_id);
        const p2 = rawPlayers.find((pl: any) => pl.id === ed.player2_id);
        const total = totalRawPlayerPoints(p1) + totalRawPlayerPoints(p2);
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

  // Quando selectedGame existe: carregar jogadores. Quando é null: só limpar se NÃO houver estado de convocatória em localStorage
  // (evita apagar duplas/jogadores selecionados antes do efeito de restauro correr — ex.: ao voltar do WhatsApp).
  useEffect(() => {
    if (selectedGame) {
      loadAvailablePlayers(selectedGame.id);
      return;
    }
    try {
      const raw = localStorage.getItem(CONVOCATION_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as { selectedGameId?: string; pairs?: unknown[]; selectedPlayerIds?: unknown[] };
        if (data?.selectedGameId && Array.isArray(data.pairs) && Array.isArray(data.selectedPlayerIds)) {
          return; // não limpar; o efeito de restauro vai repor selectedGame/pairs/selectedPlayerIds
        }
      }
    } catch (_) {}
    setAvailablePlayers([]);
    setSelectedPlayerIds(new Set());
    setPairs([
      { player1_id: '', player2_id: '' },
      { player1_id: '', player2_id: '' },
      { player1_id: '', player2_id: '' },
    ]);
  }, [selectedGame?.id]);

  useEffect(() => {
    setSentConvocationWhatsAppIds(new Set());
  }, [selectedGame?.id]);

  // Persistir dupla1, dupla2, dupla3 e jogadores selecionados no localStorage durante todo o processo (incl. envio WhatsApp).
  // Regra de fecho: o quadro só fecha em (A) clique em Cancelar/X ou (B) após Fechar Convocatória com sucesso (e aí limpamos o localStorage).
  useEffect(() => {
    if (!selectedGame?.id) return;
    try {
      const payload = {
        selectedGameId: selectedGame.id,
        pairs: [...pairs],
        selectedPlayerIds: Array.from(selectedPlayerIds),
      };
      localStorage.setItem(CONVOCATION_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }, [selectedGame?.id, pairs, selectedPlayerIds]);

  // Restaurar tab ativa a partir do URL (?tab=) ao montar (ex.: /gestao?tab=convocatorias)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'tecnica' || tabParam === 'convocatorias' || tabParam === 'performance') {
      setActiveTabState(tabParam);
      try {
        localStorage.setItem(TAB_STORAGE_KEY, tabParam);
      } catch (_) {}
    }
  }, [searchParams]);

  // Restaurar estado das duplas assim que os jogos estiverem carregados (useLayoutEffect para correr antes do paint e de outros efeitos que possam limpar).
  useLayoutEffect(() => {
    if (gamesLoading || openGames.length === 0 || hasRestoredConvocationRef.current) return;
    try {
      const raw = localStorage.getItem(CONVOCATION_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { selectedGameId?: string; pairs?: Array<{ player1_id: string; player2_id: string }>; selectedPlayerIds?: string[] };
      const gameId = data?.selectedGameId;
      if (!gameId || !Array.isArray(data.pairs) || !Array.isArray(data.selectedPlayerIds)) return;
      const game = openGames.find((g: any) => g.id === gameId);
      if (!game) return;
      hasRestoredConvocationRef.current = true;
      setSelectedGame(game);
      setPairs(data.pairs.length >= 3 ? data.pairs.slice(0, 3) : [...data.pairs, ...Array(3 - data.pairs.length).fill({ player1_id: '', player2_id: '' })].slice(0, 3));
      setSelectedPlayerIds(new Set(data.selectedPlayerIds));
      setActiveTabState('convocatorias');
      try {
        localStorage.setItem(TAB_STORAGE_KEY, 'convocatorias');
        setSearchParams({ tab: 'convocatorias' }, { replace: true });
      } catch (_) {}
    } catch (_) {}
  }, [gamesLoading, openGames]);

  /** Liga = phase Qualificação | Regionais | Nacionais → mínimo 4 jogadores; outros → mínimo 2. */
  const isLigaGame = selectedGame && ['Qualificação', 'Regionais', 'Nacionais'].includes(String(selectedGame.phase ?? ''));
  const minPlayers = isLigaGame ? 4 : 2;
  const requiredPairs = Math.floor(minPlayers / 2);

  /** Total de pontos (Liga + FPP) — mesma lógica que Perfil e Equipa */
  const totalPlayerPoints = (p: any) => (p?.liga_points ?? 0) + (p?.federation_points ?? 0);

  /** Jogadores disponíveis ordenados por Total (maior primeiro) para o Coordenador */
  const sortedAvailablePlayers = useMemo(
    () => [...availablePlayers].sort((a, b) => totalPlayerPoints(b) - totalPlayerPoints(a)),
    [availablePlayers]
  );

  /**
   * Sugestão de duplas por pontos (só quando o utilizador clica no botão). Nunca recalcular automaticamente.
   */
  const applySugestaoDuplas = () => {
    const n = selectedPlayerIds.size;
    if ((n !== 2 && n !== 4 && n !== 6) || availablePlayers.length === 0) return;
    if (isLigaGame && n < 4) return;
    const ids = Array.from(selectedPlayerIds);
    const selected = ids
      .map((id) => availablePlayers.find((p: any) => p.id === id))
      .filter(Boolean) as any[];
    if (selected.length !== n) return;
    const byPoints = [...selected].sort((a, b) => totalPlayerPoints(b) - totalPlayerPoints(a));
    const pairCount = Math.floor(n / 2);
    const newPairs: Array<{ player1_id: string; player2_id: string }> = [];
    for (let i = 0; i < pairCount; i++) {
      newPairs.push({ player1_id: byPoints[i * 2].id, player2_id: byPoints[i * 2 + 1].id });
    }
    while (newPairs.length < 3) newPairs.push({ player1_id: '', player2_id: '' });
    setPairs(newPairs);
  };

  /** Duplas ordenadas por total de pontos (Liga+FPP, maior soma → menor) para exibição no Quadro de Duplas. */
  const sortedConvocatoryPairs = useMemo(() => {
    return [...pairs]
      .map((pair, idx) => {
        const p1 = availablePlayers.find((x: any) => x.id === pair.player1_id);
        const p2 = availablePlayers.find((x: any) => x.id === pair.player2_id);
        const total = totalPlayerPoints(p1) + totalPlayerPoints(p2);
        return { pair, total, p1, p2, originalIdx: idx };
      })
      .sort((a, b) => b.total - a.total);
  }, [pairs, availablePlayers]);

  const loadOpenGames = async () => {
    setGamesLoading(true);
    try {
      const games = await GamesService.getOpenGames(true);
      setOpenGames(games);
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

  const defaultSetRow = {
    set1_casa: 0,
    set1_fora: 0,
    set2_casa: 0,
    set2_fora: 0,
    set3_casa: null as number | null,
    set3_fora: null as number | null,
  };
  const toNumResult = (v: string | number | null | undefined): number | null => {
    if (v === '' || v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) && Number.isInteger(n) ? n : null;
  };
  /** Valor para mostrar no input: aceita 0 como válido (não tratar como vazio). */
  const setInputDisplay = (v: number | null | undefined): number | '' =>
    typeof v === 'number' ? v : '';

  useEffect(() => {
    if (!selectedGameForResult?.id) {
      setResultPairs([]);
      setResultFormResults({});
      return;
    }
    let cancelled = false;
    setResultFormLoading(true);
    (async () => {
      try {
        const [pairsData, resData] = await Promise.all([
          PairsService.getByGame(selectedGameForResult.id),
          ResultsService.getByGame(selectedGameForResult.id),
        ]);
        if (cancelled) return;
        const pairList = Array.isArray(pairsData) ? pairsData : [];
        setResultPairs(pairList);
        const resMap: Record<string, { set1_casa: number; set1_fora: number; set2_casa: number; set2_fora: number; set3_casa: number | null; set3_fora: number | null }> = {};
        for (const r of resData ?? []) {
          const pid = (r as { pair_id?: string }).pair_id;
          if (pid)
            resMap[pid] = {
              set1_casa: (r as any).set1_casa ?? 0,
              set1_fora: (r as any).set1_fora ?? 0,
              set2_casa: (r as any).set2_casa ?? 0,
              set2_fora: (r as any).set2_fora ?? 0,
              set3_casa: (r as any).set3_casa ?? null,
              set3_fora: (r as any).set3_fora ?? null,
            };
        }
        setResultFormResults(resMap);
      } catch (e) {
        if (!cancelled) showToast('Erro ao carregar duplas/resultados', 'error');
      } finally {
        if (!cancelled) setResultFormLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedGameForResult?.id]);

  const handleSaveResultConfirm = async () => {
    const game = selectedGameForResult;
    if (!game?.id || !player?.user_id) return;
    setResultFormConfirmOpen(false);
    setResultFormSaving(true);
    try {
      const createdBy = String(player.user_id).trim();
      for (const pair of resultPairs) {
        const pairId = pair?.id ?? '';
        const res = resultFormResults[pairId] ?? defaultSetRow;
        const s1c = toNumResult(res.set1_casa);
        const s1f = toNumResult(res.set1_fora);
        const s2c = toNumResult(res.set2_casa);
        const s2f = toNumResult(res.set2_fora);
        if (s1c === null || s1c === undefined || s1f === null || s1f === undefined || s2c === null || s2c === undefined || s2f === null || s2f === undefined) continue;
        await ResultsService.upsertResult({
          game_id: game.id,
          pair_id: pairId,
          created_by: createdBy,
          set1_casa: Number(s1c),
          set1_fora: Number(s1f),
          set2_casa: Number(s2c),
          set2_fora: Number(s2f),
          ...(toNumResult(res.set3_casa) != null && toNumResult(res.set3_fora) != null
            ? { set3_casa: Number(res.set3_casa), set3_fora: Number(res.set3_fora) }
            : {}),
        });
      }
      await GamesService.complete(game.id);
      await syncPlayerPoints(player?.team_id ?? game?.team_id ?? undefined);
      showToast('Resultados guardados. Pontos atualizados (10 vitória / 3 derrota).', 'success');
      setSelectedGameForResult(null);
      setResultPairs([]);
      setResultFormResults({});
      await loadClosedGames();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao gravar resultados', 'error');
    } finally {
      setResultFormSaving(false);
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
        const err = closeErr as { message?: string; code?: string; details?: string };
        const msg = err?.message ?? (closeErr instanceof Error ? closeErr.message : String(closeErr));
        const detail = err?.code ? ` [${err.code}]` : '';
        showToast(`Erro ao atualizar status: ${msg}${detail}`, 'error');
        setSaving(false);
        return;
      }
      showToast('Convocatória fechada com sucesso', 'success');
      const gameInfo = {
        gameType: getCategoryFromPhase(selectedGame.phase),
        opponentOrName: GamesService.formatOpponentDisplay(selectedGame.opponent) || selectedGame.opponent || 'Jogo',
        startsAt: selectedGame.starts_at,
        location: selectedGame.location || '',
        gameId: selectedGame.id,
      };
      // --- E-mail suspenso: sendConvocationEmail desativado (sem domínio verificado no Resend só envia para o dono). ---
      // const calendarUrl = buildGoogleCalendarUrl(gameInfo);
      // const appUrl = getAppGameUrl(selectedGame.id);
      // const startsAt = new Date(selectedGame.starts_at);
      // const gameDate = startsAt.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
      // const gameTitle = `${getCategoryFromPhase(selectedGame.phase)} — ${GamesService.formatOpponentDisplay(selectedGame.opponent) || selectedGame.opponent || 'Jogo'}`;
      // const playerIdsInPairs = new Set<string>();
      // sortedConvocatoryPairs.filter((ed) => ed.pair.player1_id && ed.pair.player2_id).forEach((ed) => { playerIdsInPairs.add(ed.pair.player1_id); playerIdsInPairs.add(ed.pair.player2_id); });
      // const sent: string[] = []; const failed: string[] = [];
      // for (const playerId of playerIdsInPairs) {
      //   const pl = availablePlayers.find((p: any) => p.id === playerId) as { email?: string; name?: string } | undefined;
      //   const email = pl?.email?.trim();
      //   if (!email || !email.includes('@')) continue;
      //   const result = await sendConvocationEmail({ to: email, playerName: pl?.name || 'Jogador', gameTitle, gameDate, gameTime, gameLocation: selectedGame.location || '', appUrl, calendarUrl });
      //   if (result.ok) sent.push(pl?.name || email); else failed.push(pl?.name || email);
      // }
      // if (failed.length > 0) showToast(`${sent.length} email(s) enviado(s). Falha em: ${failed.join(', ')}. Usa "Partilhar via WhatsApp" em baixo.`, 'error');
      // else if (sent.length > 0) showToast(`Convocatória fechada e ${sent.length} email(s) de convocatória enviado(s).`, 'success');
      setConvocationShareInfo({ gameInfo, hadEmailFailures: false });
      try {
        localStorage.removeItem(CONVOCATION_STORAGE_KEY);
      } catch (_) {}
      setSelectedGame(null);
      await loadOpenGames();
      await loadClosedGames();
      await loadDashboard();
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
    if (authLoading && !isOwner) return;
    // Dono (jco.simoes@gmail.com): ignora verificação de team_id/role; permite criar mesmo com BD vazia (usa user.id).
    const createdBy = player?.id ?? (isOwner ? user?.id : null);
    if (!createdBy) {
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
        team_id: effectiveTeamId ?? player?.team_id ?? null,
        created_by: createdBy,
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

  if (!canManage) {
    return (
      <Layout>
        <Header title="Gestão de Jogos" onBack={goBack} />
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

  const totalTeamGames = teamStats ? teamStats.wins + teamStats.losses + teamStats.noShows : 0;
  /** Ranking a mostrar: Geral = ranking do dashboard; Liga/Treinos = rankingByCategory. Fallback: array vazio para não crashar. */
  const displayRanking = rankingCategoryFilter === 'Geral' ? (Array.isArray(ranking) ? ranking : []) : (rankingByCategory ?? []);
  /** Fonte de disp/conv e total de eventos conforme categoria. Fallback: array vazio. */
  const statsForRanking = rankingCategoryFilter === 'Geral' ? (Array.isArray(seasonStatsEpoca) ? seasonStatsEpoca : []) : (rankingCategoryStats ?? []);
  const totalEventsForRanking = rankingCategoryFilter === 'Geral' ? (totalGamesEpoca ?? 0) : (rankingCategoryTotalGames ?? 0);

  const rankingWithDisp = useMemo(() => {
    const safeStats = Array.isArray(statsForRanking) ? statsForRanking : [];
    const safeRanking = Array.isArray(displayRanking) ? displayRanking : [];
    const dispByPlayer = new Map(safeStats.map((s) => [s.player_id, s.disponibilidade]));
    const convByPlayer = new Map(safeStats.map((s) => [s.player_id, s.convocatorias]));
    return safeRanking.map((row) => {
      const presencas = dispByPlayer.get(row.player_id) ?? 0;
      const jogos = convByPlayer.get(row.player_id) ?? 0;
      const rawPct = totalEventsForRanking > 0 ? (presencas / totalEventsForRanking) * 100 : 0;
      const disponibilidade_pct = totalEventsForRanking > 0 ? Math.min(100, Math.round(rawPct)) : 0;
      return {
        ...row,
        disponibilidade: presencas,
        disponibilidade_pct,
        jogos,
      };
    });
  }, [displayRanking, statsForRanking, totalEventsForRanking]);

  /** Cor da % disponibilidade: Verde >80%, Amarelo 50–80%, Vermelho <50% */
  const dispPctColor = (pct: number) =>
    pct > 80 ? 'text-green-700' : pct >= 50 ? 'text-amber-600' : 'text-red-600';

  /** Cor da Eficácia: Verde 100%, Amarelo/Laranja 50–70%, Cinzento 0% */
  const eficaciaColor = (pct: number) => {
    if (pct >= 100) return 'text-green-600 font-semibold';
    if (pct >= 50) return 'text-amber-600 font-medium';
    return 'text-gray-500';
  };

  const STATS_AVATAR_COLORS = ['bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'];

  const canRecalcularPontos = role === PlayerRoles.admin || role === PlayerRoles.coordenador;

  const tabStyles = (tab: 'performance' | 'tecnica' | 'convocatorias') => {
    const isActive = activeTab === tab;
    return [
      'flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all duration-200',
      isActive
        ? 'bg-blue-50 text-[#1A237E] font-bold shadow-sm border-b-[3px] border-[#1A237E] rounded-b-xl'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800 font-medium',
    ].join(' ');
  };

  return (
    <Layout>
      <Header
        title="Gestão de Jogos"
        onBack={goBack}
        rightContent={
          canRecalcularPontos ? (
            <button
              type="button"
              onClick={handleRecalcularPontos}
              disabled={recalculatingPoints}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              title="Recalcular Pontos Liga"
              aria-label="Recalcular Pontos"
            >
              {recalculatingPoints ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
              <span className="hidden sm:inline">Recalcular Pontos</span>
            </button>
          ) : undefined
        }
      />
      <div className="max-w-screen-lg mx-auto px-4 pt-4 pb-6 space-y-6">
        {/* Tabs: card branco, pílulas com ícones, estado ativo com linha inferior */}
        <Card className="p-2 bg-white shadow-sm border border-gray-100 rounded-2xl">
          <div className="flex gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={tabStyles('performance')}
              aria-pressed={activeTab === 'performance'}
            >
              <TrendingUp className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              <span>Performance</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tecnica')}
              className={tabStyles('tecnica')}
              aria-pressed={activeTab === 'tecnica'}
            >
              <Settings className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              <span>Gestão Técnica</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('convocatorias')}
              className={tabStyles('convocatorias')}
              aria-pressed={activeTab === 'convocatorias'}
            >
              <ClipboardList className="w-4 h-4 shrink-0 opacity-80" aria-hidden />
              <span>Convocatórias</span>
            </button>
          </div>
        </Card>

        {/* Tab 1: Performance — Equipa + Ranking Individual */}
        {activeTab === 'performance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-sm rounded-xl border border-gray-100 flex flex-col">
            <div className="p-6">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Medal className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-base font-medium text-gray-900">Performance da Equipa M6</h3>
              </div>
              <p className="text-sm text-gray-500 mt-1.5">
                Liga: Vitória 3 pts · Derrota 1 pt · Falta 0 pts
              </p>
              {dashboardLoading ? (
                <div className="mt-4 py-6 text-center text-gray-500">A carregar...</div>
              ) : teamStats ? (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                    <div className="text-2xl font-bold text-green-700">{teamStats.wins}</div>
                    <div className="text-xs text-green-600 mt-0.5">Vitórias</div>
                  </div>
                  <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                    <div className="text-2xl font-bold text-red-700">{teamStats.losses}</div>
                    <div className="text-xs text-red-600 mt-0.5">Derrotas</div>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="text-2xl font-bold text-gray-700">{teamStats.noShows}</div>
                    <div className="text-xs text-gray-600 mt-0.5">Faltas</div>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 col-span-2 sm:col-span-1">
                    <div className="text-2xl font-bold text-amber-800">{teamStats.totalPoints}</div>
                    <div className="text-xs text-amber-700 mt-0.5">Total ({teamStats.record})</div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 py-4 text-center text-gray-500">Sem dados disponíveis. Cria a tua primeira equipa para começar.</div>
              )}
            </div>
          </Card>

          <Card className="shadow-sm rounded-xl border border-gray-100 flex flex-col md:col-span-1">
            <div className="p-6">
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="text-base font-medium text-gray-900">Ranking Individual</h3>
              </div>
              <p className="text-sm text-gray-500 mt-1.5">
                Liga · Fed. · Total · Conv. = vezes convocado · % Disp. = (marcou disponível / eventos) × 100
              </p>
              {/* Filtro por categoria: Jogos e % Disp. atualizam por Geral / Liga / Treinos */}
              <div className="mt-3 flex flex-wrap gap-2">
                {(['Geral', 'Liga', 'Treino'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setRankingCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      rankingCategoryFilter === cat
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                    }`}
                  >
                    {cat === 'Treino' ? 'Treinos' : cat}
                  </button>
                ))}
              </div>
              {dashboardLoading || (rankingCategoryFilter !== 'Geral' && rankingCategoryLoading) ? (
                <div className="mt-4 py-6 text-center text-gray-500">A carregar...</div>
              ) : (
                <div className="mt-4 overflow-x-auto -mx-1 px-1">
                  <table className="w-full text-sm border-collapse min-w-[400px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-1 font-semibold text-gray-700">#</th>
                        <th className="text-left py-2 px-1 font-semibold text-gray-700">Jogador</th>
                        <th
                          className="text-right py-2 px-1 font-semibold text-amber-700 cursor-pointer hover:bg-amber-50/80 rounded select-none"
                          onClick={() => { setRankingSortBy('liga'); setRankingSortAsc(rankingSortBy === 'liga' ? !rankingSortAsc : false); }}
                        >
                          Liga {rankingSortBy === 'liga' && (rankingSortAsc ? '↑' : '↓')}
                        </th>
                        <th
                          className="text-right py-2 px-1 font-semibold text-blue-700 cursor-pointer hover:bg-blue-50/80 rounded select-none"
                          onClick={() => { setRankingSortBy('federacao'); setRankingSortAsc(rankingSortBy === 'federacao' ? !rankingSortAsc : false); }}
                        >
                          Fed. {rankingSortBy === 'federacao' && (rankingSortAsc ? '↑' : '↓')}
                        </th>
                        <th
                          className="text-right py-2 px-1 font-semibold text-gray-800 cursor-pointer hover:bg-gray-100 rounded select-none"
                          onClick={() => { setRankingSortBy('total'); setRankingSortAsc(rankingSortBy === 'total' ? !rankingSortAsc : false); }}
                        >
                          Total {rankingSortBy === 'total' && (rankingSortAsc ? '↑' : '↓')}
                        </th>
                        <th
                          className="text-right py-2 px-1 font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 rounded select-none"
                          onClick={() => { setRankingSortBy('conv'); setRankingSortAsc(rankingSortBy === 'conv' ? !rankingSortAsc : false); }}
                          title="Jogos: vezes convocado (selecionado/jogado) na categoria"
                        >
                          Conv. {rankingSortBy === 'conv' && (rankingSortAsc ? '↑' : '↓')}
                        </th>
                        <th
                          className="text-right py-2 px-1 font-semibold text-green-700 cursor-pointer hover:bg-green-50/80 rounded select-none"
                          onClick={() => { setRankingSortBy('disp'); setRankingSortAsc(rankingSortBy === 'disp' ? !rankingSortAsc : false); }}
                          title="% Disp. = (marcou disponível / total eventos) × 100"
                        >
                          % Disp. {rankingSortBy === 'disp' && (rankingSortAsc ? '↑' : '↓')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingWithDisp.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-gray-500">Sem dados disponíveis. Cria a tua primeira equipa para começar.</td>
                        </tr>
                      ) : (
                        (() => {
                          const sorted = [...rankingWithDisp].sort((a, b) => {
                            if (rankingSortBy === 'disp') {
                              const va = (a as { disponibilidade_pct?: number }).disponibilidade_pct ?? 0;
                              const vb = (b as { disponibilidade_pct?: number }).disponibilidade_pct ?? 0;
                              return rankingSortAsc ? va - vb : vb - va;
                            }
                            if (rankingSortBy === 'conv') {
                              const va = (a as { jogos?: number }).jogos ?? 0;
                              const vb = (b as { jogos?: number }).jogos ?? 0;
                              return rankingSortAsc ? va - vb : vb - va;
                            }
                            const key = rankingSortBy === 'liga' ? 'pontos_liga' : rankingSortBy === 'federacao' ? 'federation_points' : 'total_points';
                            const va = a[key] ?? 0;
                            const vb = b[key] ?? 0;
                            return rankingSortAsc ? va - vb : vb - va;
                          });
                          return sorted.map((row, idx) => (
                            <tr key={row.player_id} className="border-b border-gray-100 hover:bg-gray-50/50">
                              <td className="py-2 px-1 text-gray-600">{idx + 1}</td>
                              <td className="py-2 px-1 font-medium text-gray-900 truncate max-w-[100px]">{row.name}</td>
                              <td className="py-2 px-1 text-right text-amber-700">{row.pontos_liga}</td>
                              <td className="py-2 px-1 text-right text-blue-600">{row.federation_points}</td>
                              <td className="py-2 px-1 text-right font-semibold text-gray-900">{row.total_points}</td>
                              <td className="py-2 px-1 text-right text-gray-700">{(row as { jogos?: number }).jogos ?? 0}</td>
                              <td className={`py-2 px-1 text-right font-medium ${dispPctColor((row as { disponibilidade_pct?: number }).disponibilidade_pct ?? 0)}`}>
                                {(row as { disponibilidade_pct?: number }).disponibilidade_pct ?? 0}%
                              </td>
                            </tr>
                          ));
                        })()
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>
        </div>
        )}

        {/* Tab 2: Gestão Técnica — Estatísticas de Época (Taxa de Escolha, Disponibilidade) */}
        {activeTab === 'tecnica' && (
        <Card className="shadow-sm rounded-xl border border-gray-100">
          <div className="p-6">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <BarChart2 className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-base font-medium text-gray-900">Estatísticas de Época</h3>
            </div>
            <p className="text-sm text-gray-500 mt-1.5">
              Taxa de Escolha = Convocatórias ÷ Disponibilidade (ex: 1/4 = 25%). Rodar = quem quer jogar e ainda não foi tanto convocado.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 items-center">
              <span className="text-xs text-gray-500">Filtro:</span>
              <select
                value={statsFilter}
                onChange={(e) => setStatsFilter(e.target.value as 'epoca' | 'mes')}
                className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white"
              >
                <option value="epoca">Toda a época</option>
                <option value="mes">Último mês</option>
              </select>
              <span className="text-xs text-gray-500 ml-2">Ordenar:</span>
              <button
                type="button"
                onClick={() => { setSeasonStatsSortBy('disponibilidade'); setSeasonStatsSortAsc(seasonStatsSortBy === 'disponibilidade' ? !seasonStatsSortAsc : false); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${seasonStatsSortBy === 'disponibilidade' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Disponibilidade {seasonStatsSortBy === 'disponibilidade' && (seasonStatsSortAsc ? '↑' : '↓')}
              </button>
              <button
                type="button"
                onClick={() => { setSeasonStatsSortBy('pontos_liga'); setSeasonStatsSortAsc(seasonStatsSortBy === 'pontos_liga' ? !seasonStatsSortAsc : false); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${seasonStatsSortBy === 'pontos_liga' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Pontos Liga {seasonStatsSortBy === 'pontos_liga' && (seasonStatsSortAsc ? '↑' : '↓')}
              </button>
            </div>
            {dashboardLoading ? (
              <div className="mt-4 py-6 text-center text-gray-500">A carregar...</div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm border-collapse min-w-[520px]">
                  <thead>
                    <tr className="bg-gray-100/90 border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-bold text-gray-800">Jogador</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-800 tabular-nums">Disp.</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-800 tabular-nums">Conv.</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-800">Taxa Escolha</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-800">V–D</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-800">Eficácia</th>
                      <th className="text-right py-3 px-4 font-bold text-gray-800">Liga M6</th>
                      <th className="text-center py-3 px-4 font-bold text-gray-800" title="Muita disponibilidade, poucas convocatórias">Rodar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(statsFilter === 'epoca' ? seasonStatsEpoca : seasonStatsMes).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-gray-500">Sem dados disponíveis. Cria a tua primeira equipa para começar.</td>
                      </tr>
                    ) : (
                      (() => {
                        const stats = statsFilter === 'epoca' ? seasonStatsEpoca : seasonStatsMes;
                        const sorted = [...stats].sort((a, b) => {
                          const key = seasonStatsSortBy;
                          const va = key === 'disponibilidade' ? a.disponibilidade : a.pontos_liga;
                          const vb = key === 'disponibilidade' ? b.disponibilidade : b.pontos_liga;
                          return seasonStatsSortAsc ? va - vb : vb - va;
                        });
                        return sorted.map((row, index) => {
                          const initials = (row.name || '?').trim().split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase() || '?';
                          const avatarBg = STATS_AVATAR_COLORS[index % STATS_AVATAR_COLORS.length];
                          const isEven = index % 2 === 0;
                          return (
                            <tr
                              key={row.player_id}
                              className={`border-b border-gray-100 transition-colors duration-150 hover:bg-blue-50/70 hover:shadow-inner ${row.highlight_rodar ? 'bg-amber-50/60' : ''} ${isEven ? 'bg-gray-50/40' : 'bg-white'}`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarBg}`} aria-hidden>
                                    {initials}
                                  </span>
                                  <span className="font-medium text-gray-900">{row.name}</span>
                                </div>
                              </td>
                              <td className={`py-3 px-4 text-right font-medium tabular-nums ${dispPctColor(row.disp_pct ?? 0)}`} title={row.disp_pct != null ? `${row.disponibilidade} de ${statsFilter === 'epoca' ? totalGamesEpoca : totalGamesMes} jogos (${row.disp_pct}%)` : undefined}>
                                {row.disp_pct != null ? `${row.disponibilidade} (${row.disp_pct}%)` : row.disponibilidade}
                              </td>
                              <td className="py-3 px-4 text-right text-gray-700 tabular-nums font-medium">{row.convocatorias}</td>
                              <td className="py-3 px-4 text-right text-gray-700 tabular-nums">{row.taxa_escolha}%</td>
                              <td className="py-3 px-4 text-right tabular-nums">
                                <span className="text-green-600 font-semibold">{row.wins}V</span>
                                <span className="text-gray-400 mx-0.5">–</span>
                                <span className="text-red-600 font-semibold">{row.losses}D</span>
                              </td>
                              <td className={`py-3 px-4 text-right tabular-nums ${eficaciaColor(row.eficacia ?? 0)}`}>
                                {row.eficacia}%
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-amber-700 tabular-nums">{row.pontos_liga}</td>
                              <td className="py-3 px-4 text-center">
                                {row.highlight_rodar ? (
                                  <span className="inline-flex items-center justify-center text-orange-500" title="Muita disponibilidade, poucas convocatórias — considerar rodar">
                                    <UserCheck className="w-5 h-5" aria-hidden />
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center text-gray-400">
                                    <UserCheck className="w-5 h-5" aria-hidden />
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
        )}

        {/* Tab 3: Convocatórias — Criar jogo, Jogos em aberto, Substituições */}
        {activeTab === 'convocatorias' && (
        <>
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
              disabled={loading || (!isOwner && role !== PlayerRoles.admin && authLoading)}
              className={CATEGORY_STYLES[gameType].buttonClasses}
            >
              {!isOwner && role !== PlayerRoles.admin && authLoading ? 'A carregar perfil...' : loading ? 'A criar...' : 'Criar e Abrir Convocatória'}
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

          {convocationShareInfo && (
            <div className="mb-4 p-4 rounded-xl border-2 border-green-200 bg-green-50/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {convocationShareInfo.hadEmailFailures
                    ? 'Alguns e-mails não foram enviados (ex.: sem domínio verificado no Resend). Partilha a convocatória via WhatsApp para garantir que todos recebem.'
                    : 'Partilha também a convocatória via WhatsApp — inclui o link do Google Calendar e o link da App.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const url = buildWhatsAppConvocationUrl(convocationShareInfo.gameInfo);
                    window.open(url, '_blank', 'noreferrer');
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white border-0 inline-flex items-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  Partilhar Convocatória via WhatsApp
                </Button>
                <button
                  type="button"
                  onClick={() => setConvocationShareInfo(null)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-green-100 hover:text-gray-700 transition-colors"
                  aria-label="Fechar"
                  title="Fechar"
                >
                  <span className="text-lg leading-none">×</span>
                </button>
              </div>
            </div>
          )}

          {gamesLoading ? (
            <Loading text="A carregar..." />
          ) : openGames.length === 0 ? (
            <div className="text-center py-6">
              <Lock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600 font-medium">{effectiveTeamId ? 'Sem jogos em aberto' : 'Sem dados disponíveis. Cria a tua primeira equipa para começar.'}</p>
              <p className="text-xs text-gray-500 mt-1">{effectiveTeamId ? 'Cria um jogo acima para abrir convocatória' : 'Vai ao Painel Admin para criar a equipa e os jogadores.'}</p>
            </div>
          ) : (
            <div className={GRID_CLASSES}>
              {openGames.map((game: any) => {
                const cat = getCategoryFromPhase(game.phase);
                const styles = CATEGORY_STYLES[cat];
                const isPastDate = new Date(game.starts_at) < new Date();
                const isSameGame = selectedGame?.id === game.id;
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => {
                      if (isSameGame) return;
                      try {
                        const raw = localStorage.getItem(CONVOCATION_STORAGE_KEY);
                        if (raw) {
                          const data = JSON.parse(raw) as { selectedGameId?: string; pairs?: Array<{ player1_id: string; player2_id: string }>; selectedPlayerIds?: string[] };
                          if (data?.selectedGameId === game.id && Array.isArray(data.pairs) && Array.isArray(data.selectedPlayerIds)) {
                            setPairs(data.pairs.length >= 3 ? data.pairs.slice(0, 3) : [...data.pairs, ...Array(3 - data.pairs.length).fill({ player1_id: '', player2_id: '' })].slice(0, 3));
                            setSelectedPlayerIds(new Set(data.selectedPlayerIds));
                          }
                        }
                      } catch (_) {}
                      setSelectedGame(game);
                    }}
                    className={`relative text-left rounded-xl overflow-hidden shadow-lg border-2 transition-all ${
                      selectedGame?.id === game.id ? 'ring-2 ring-offset-2 ring-blue-500 border-blue-500' : isPastDate ? 'border-amber-400 bg-amber-50/30 hover:shadow-xl' : 'border-transparent hover:shadow-xl'
                    }`}
                  >
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                      {GamesService.canDeleteGame(game) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGameToDelete(game);
                          }}
                          disabled={deletingGameId === game.id}
                          className="p-1.5 rounded-lg bg-white/90 hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors shadow-sm disabled:opacity-50"
                          aria-label="Eliminar convocatória"
                          title="Eliminar convocatória"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const url = buildWhatsAppShareUrl({
                            gameType: getCategoryFromPhase(game.phase),
                            opponentOrName: GamesService.formatOpponentDisplay(game.opponent) || game.opponent || 'Jogo',
                            startsAt: game.starts_at,
                            location: game.location || '',
                            gameId: game.id,
                          });
                          window.open(url, '_blank', 'noreferrer');
                        }}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-green-100 text-gray-600 hover:text-green-700 transition-colors shadow-sm"
                        aria-label="Partilhar no WhatsApp"
                        title="Partilhar no WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGameToEdit(game);
                        }}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors shadow-sm"
                        aria-label="Editar jogo"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
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
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Convocatória aberta — {selectedGame.opponent || 'Jogo'}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedGame(null);
                  }}
                  className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
                  aria-label="Cancelar e fechar convocatória (rascunho fica guardado)"
                  title="Cancelar (o rascunho fica guardado)"
                >
                  <span className="text-xl leading-none">×</span>
                </button>
              </div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Jogadores confirmados (status = confirmed)</h4>

              {availablePlayers.length < minPlayers ? (
                <p className="text-sm text-amber-700 mb-4">
                  Apenas {availablePlayers.length} jogador(es) confirmaram presença. {isLigaGame ? 'Liga: são necessários pelo menos 4.' : 'São necessários pelo menos 2.'}
                </p>
              ) : (
                <p className="text-sm text-gray-600 mb-4">
                  {isLigaGame ? 'Seleciona 4 ou 6 jogadores (clica para selecionar).' : 'Seleciona 2, 4 ou 6 jogadores (clica para selecionar).'} As duplas são calculadas automaticamente por pontos.
                </p>
              )}

              {selectedGame && (() => {
                const gameInfoForShare: GameShareInfo = {
                  gameType: getCategoryFromPhase(selectedGame.phase),
                  opponentOrName: GamesService.formatOpponentDisplay(selectedGame.opponent) || selectedGame.opponent || 'Jogo',
                  startsAt: selectedGame.starts_at,
                  location: selectedGame.location || '',
                  gameId: selectedGame.id,
                };
                return (
                  <div
                    className="mb-6"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    role="region"
                    aria-label="Convocatória aberta"
                  >
                  <div className="mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-800">Jogadores confirmados</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Ordenados por Total (Liga + FPP). Clica na linha para selecionar para as duplas. Envia o convite pelo ícone WhatsApp no Quadro de Duplas.</p>
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {sortedAvailablePlayers.map((p: any) => {
                        const sel = selectedPlayerIds.has(p.id);
                        return (
                          <li
                            key={p.id}
                            className={`flex items-center justify-between gap-4 px-4 py-3 transition-colors ${
                              sel ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => togglePlayer(p.id)}
                              className="flex-1 flex items-center justify-between gap-3 text-left min-w-0"
                            >
                              <span className="font-medium text-gray-900 truncate">{p.name}</span>
                              <span className="text-sm text-gray-600 shrink-0 font-medium tabular-nums">Total: {totalPlayerPoints(p)} pts</span>
                            </button>
                            <span className="flex items-center justify-center w-8 h-8 rounded-full shrink-0" aria-hidden>
                              {sel ? (
                                <Check className="w-5 h-5 text-blue-600" aria-label="Selecionado" />
                              ) : (
                                <Circle className="w-5 h-5 text-gray-300" aria-label="Não selecionado" />
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  </div>
                );
              })()}

              {selectedPlayerIds.size >= minPlayers && (
                <>
                  {/* Isolar cliques (ex.: WhatsApp) para não propagar ao Router e manter o ecrã montado */}
                  <div
                    className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 mb-6"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    role="group"
                    aria-label="Quadro de Duplas"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 mb-1">Quadro de Duplas</h4>
                        <p className="text-xs text-gray-600">
                          Dupla 1 = maior soma · Dupla 2 = intermédia · Dupla 3 = menor soma. As duplas só mudam quando tu as alteras ou clicas em &quot;Sugestão de Duplas&quot;.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          applySugestaoDuplas();
                        }}
                        className="shrink-0 px-4 py-2 rounded-lg border-2 border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium text-sm transition-colors"
                      >
                        Sugestão de Duplas
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {selectedGame && sortedConvocatoryPairs.map((ed, idx) => {
                        const label =
                          idx === 0 ? 'Dupla 1 (maior soma)' : idx === 1 ? 'Dupla 2 (média)' : 'Dupla 3 (menor soma)';
                        const duplaShort = `Dupla ${idx + 1}`;
                        const gameInfoDupla: GameShareInfo = {
                          gameType: getCategoryFromPhase(selectedGame.phase),
                          opponentOrName: GamesService.formatOpponentDisplay(selectedGame.opponent) || selectedGame.opponent || 'Jogo',
                          startsAt: selectedGame.starts_at,
                          location: selectedGame.location || '',
                          gameId: selectedGame.id,
                        };
                        const pl1 = availablePlayers.find((x: any) => x.id === ed.pair.player1_id);
                        const pl2 = availablePlayers.find((x: any) => x.id === ed.pair.player2_id);
                        const sent1 = pl1 ? sentConvocationWhatsAppIds.has(pl1.id) : false;
                        const sent2 = pl2 ? sentConvocationWhatsAppIds.has(pl2.id) : false;
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
                                <div className="flex items-center gap-2">
                                  <select
                                    aria-label="Jogador 1"
                                    value={ed.pair.player1_id}
                                    onChange={(e) => assignPair(ed.originalIdx, 'player1_id', e.target.value)}
                                    className="flex-1 min-w-0 text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  >
                                    <option value="">Jogador 1...</option>
                                    {Array.from(selectedPlayerIds).map((id) => {
                                      const pl = availablePlayers.find((x: any) => x.id === id);
                                      return (
                                        <option key={id} value={id} disabled={ed.pair.player2_id === id}>
                                          {pl?.name} (Total: {pl ? totalPlayerPoints(pl) : 0} pts)
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {ed.pair.player1_id && pl1 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const url = buildWhatsAppDuplaConvocationUrl(gameInfoDupla, pl1.name ?? 'Jogador', duplaShort, pl1.phone);
                                        setSentConvocationWhatsAppIds((prev) => new Set(prev).add(pl1.id));
                                        setTimeout(() => window.open(url, '_blank', 'noreferrer'), 0);
                                      }}
                                      disabled={sent1}
                                      className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors ${
                                        sent1 ? 'bg-gray-200 text-gray-500 cursor-default' : 'bg-green-500 hover:bg-green-600 text-white'
                                      }`}
                                      title={sent1 ? 'Convite enviado' : 'Enviar convite por WhatsApp'}
                                      aria-label={sent1 ? 'Convite enviado' : 'Enviar convite por WhatsApp'}
                                    >
                                      {sent1 ? <Check className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                                    </button>
                                  )}
                                </div>
                                <span className="flex justify-center text-amber-600 font-medium text-xs">+</span>
                                <div className="flex items-center gap-2">
                                  <select
                                    aria-label="Jogador 2"
                                    value={ed.pair.player2_id}
                                    onChange={(e) => assignPair(ed.originalIdx, 'player2_id', e.target.value)}
                                    className="flex-1 min-w-0 text-sm border border-gray-300 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                  >
                                    <option value="">Jogador 2...</option>
                                    {Array.from(selectedPlayerIds).map((id) => {
                                      const pl = availablePlayers.find((x: any) => x.id === id);
                                      return (
                                        <option key={id} value={id} disabled={ed.pair.player1_id === id}>
                                          {pl?.name} (Total: {pl ? totalPlayerPoints(pl) : 0} pts)
                                        </option>
                                      );
                                    })}
                                  </select>
                                  {ed.pair.player2_id && pl2 && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const url = buildWhatsAppDuplaConvocationUrl(gameInfoDupla, pl2.name ?? 'Jogador', duplaShort, pl2.phone);
                                        setSentConvocationWhatsAppIds((prev) => new Set(prev).add(pl2.id));
                                        setTimeout(() => window.open(url, '_blank', 'noreferrer'), 0);
                                      }}
                                      disabled={sent2}
                                      className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors ${
                                        sent2 ? 'bg-gray-200 text-gray-500 cursor-default' : 'bg-green-500 hover:bg-green-600 text-white'
                                      }`}
                                      title={sent2 ? 'Convite enviado' : 'Enviar convite por WhatsApp'}
                                      aria-label={sent2 ? 'Convite enviado' : 'Enviar convite por WhatsApp'}
                                    >
                                      {sent2 ? <Check className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    type="button"
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

        {/* Registo de Resultado — jogos com duplas fechadas ou data passada */}
        <CategoryCard
          category="Liga"
          header={
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5" />
              Registo de Resultado
            </h2>
          }
        >
          <p className="text-sm text-gray-600 mb-4">
            Regista os parciais (sets) dos jogos com convocatória já fechada. O card só está ativo quando o jogo tem duplas definidas ou a data já passou. Após gravar, o jogo fica <strong>Finalizado</strong> e os pontos (10 vitória / 3 derrota) são atualizados automaticamente.
          </p>

          {closedGamesLoading ? (
            <Loading text="A carregar jogos..." />
          ) : closedGames.length === 0 ? (
            <p className="text-sm text-gray-500">{effectiveTeamId ? 'Nenhum jogo com convocatória fechada para registar resultado.' : 'Sem dados disponíveis. Cria a tua primeira equipa para começar.'}</p>
          ) : (
            <div className="space-y-4">
              <div className={GRID_CLASSES}>
                {closedGames.map((game: any) => {
                  const cat = getCategoryFromPhase(game.phase);
                  const styles = CATEGORY_STYLES[cat];
                  const isPastDate = new Date(game.starts_at) < new Date();
                  const isSelected = selectedGameForResult?.id === game.id;
                  return (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => setSelectedGameForResult(isSelected ? null : game)}
                      className={`relative text-left rounded-xl overflow-hidden shadow-lg border-2 transition-all hover:shadow-xl ${
                        isSelected ? 'ring-2 ring-offset-2 ring-emerald-500 border-emerald-500' : isPastDate ? 'border-amber-400 bg-amber-50/30' : 'border-transparent'
                      }`}
                    >
                      <div className={`px-3 py-2 ${styles.headerGradient} text-white text-sm font-semibold`}>
                        {GamesService.formatOpponentDisplay(game.opponent)}
                      </div>
                      <div className="p-3 bg-white">
                        <span className="text-xs text-gray-600">
                          {new Date(game.starts_at).toLocaleDateString('pt-PT')} — {game.location}
                        </span>
                        {isPastDate && (
                          <div className="mt-2 flex items-center gap-1 text-amber-700 text-xs font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Data passada
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedGameForResult && (
                <div className="mt-6 pt-6 border-t border-gray-200 rounded-xl border border-gray-200 overflow-hidden shadow-md bg-white">
                  <div className="flex items-center justify-between gap-4 p-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                      Resultados — {selectedGameForResult.opponent || 'Jogo'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => { setSelectedGameForResult(null); setResultFormResults({}); }}
                      className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors shrink-0"
                      aria-label="Fechar"
                      title="Fechar"
                    >
                      <span className="text-xl leading-none">×</span>
                    </button>
                  </div>
                  <div className="p-4 space-y-4">
                    <p className="text-sm text-gray-600">
                      Introduz os resultados de cada dupla. Set 1 e Set 2 são obrigatórios. Set 3 só se o resultado for 1-1.
                    </p>
                    {resultFormLoading ? (
                      <Loading text="A carregar duplas..." />
                    ) : resultPairs.length === 0 ? (
                      <p className="text-sm text-amber-700">Este jogo ainda não tem duplas definidas. Fecha a convocatória primeiro.</p>
                    ) : (
                      <>
                        <div className="space-y-4">
                          {resultPairs.map((pair: any) => {
                            const pairId = pair?.id ?? '';
                            const res = resultFormResults[pairId] ?? defaultSetRow;
                            const p1 = pair?.player1?.name ?? '—';
                            const p2 = pair?.player2?.name ?? '—';
                            return (
                              <div key={pairId} className="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-3">
                                <div className="font-medium text-gray-900">{p1} + {p2}</div>
                                <div className="grid grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-xs text-gray-600 mb-1">Set 1 (casa - fora)</label>
                                    <div className="flex gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={7}
                                        placeholder="6"
                                        value={setInputDisplay(res.set1_casa)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                                        onChange={(e) => setResultFormResults((prev) => ({
                                          ...prev,
                                          [pairId]: { ...defaultSetRow, ...prev[pairId], set1_casa: toNumResult(e.target.value) ?? 0 },
                                        }))}
                                      />
                                      <span className="flex items-center">-</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={7}
                                        placeholder="4"
                                        value={setInputDisplay(res.set1_fora)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                                        onChange={(e) => setResultFormResults((prev) => ({
                                          ...prev,
                                          [pairId]: { ...defaultSetRow, ...prev[pairId], set1_fora: toNumResult(e.target.value) ?? 0 },
                                        }))}
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
                                        value={setInputDisplay(res.set2_casa)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                                        onChange={(e) => setResultFormResults((prev) => ({
                                          ...prev,
                                          [pairId]: { ...defaultSetRow, ...prev[pairId], set2_casa: toNumResult(e.target.value) ?? 0 },
                                        }))}
                                      />
                                      <span className="flex items-center">-</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={7}
                                        placeholder="4"
                                        value={setInputDisplay(res.set2_fora)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                                        onChange={(e) => setResultFormResults((prev) => ({
                                          ...prev,
                                          [pairId]: { ...defaultSetRow, ...prev[pairId], set2_fora: toNumResult(e.target.value) ?? 0 },
                                        }))}
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
                                        value={setInputDisplay(res.set3_casa ?? undefined)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                                        onChange={(e) => setResultFormResults((prev) => ({
                                          ...prev,
                                          [pairId]: { ...defaultSetRow, ...prev[pairId], set3_casa: toNumResult(e.target.value) },
                                        }))}
                                      />
                                      <span className="flex items-center">-</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={7}
                                        placeholder="—"
                                        value={setInputDisplay(res.set3_fora ?? undefined)}
                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500"
                                        onChange={(e) => setResultFormResults((prev) => ({
                                          ...prev,
                                          [pairId]: { ...defaultSetRow, ...prev[pairId], set3_fora: toNumResult(e.target.value) },
                                        }))}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <Button
                          fullWidth
                          className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg rounded-xl font-semibold"
                          disabled={resultFormSaving}
                          onClick={() => {
                            const is66 = (c: number | null | undefined, f: number | null | undefined) =>
                              c === 6 && f === 6;
                            for (const pair of resultPairs) {
                              const res = resultFormResults[pair?.id ?? ''] ?? defaultSetRow;
                              const s1c = toNumResult(res.set1_casa);
                              const s1f = toNumResult(res.set1_fora);
                              const s2c = toNumResult(res.set2_casa);
                              const s2f = toNumResult(res.set2_fora);
                              const s3c = toNumResult(res.set3_casa);
                              const s3f = toNumResult(res.set3_fora);
                              if (s1c !== null && s1f !== null && is66(s1c, s1f)) {
                                showToast('Em caso de 6-6, insira o resultado do tie-break (ex: 7-6 ou 6-7).', 'error');
                                return;
                              }
                              if (s2c !== null && s2f !== null && is66(s2c, s2f)) {
                                showToast('Em caso de 6-6, insira o resultado do tie-break (ex: 7-6 ou 6-7).', 'error');
                                return;
                              }
                              if (s3c !== null && s3f !== null && is66(s3c, s3f)) {
                                showToast('Em caso de 6-6, insira o resultado do tie-break (ex: 7-6 ou 6-7).', 'error');
                                return;
                              }
                            }
                            setResultFormConfirmOpen(true);
                          }}
                        >
                          {resultFormSaving ? 'A guardar...' : 'Gravar Resultado'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <ConfirmDialog
            isOpen={resultFormConfirmOpen}
            title="Confirmar gravação"
            message="Tem a certeza de que os dados estão corretos? O jogo ficará Finalizado e os pontos (10 vitória / 3 derrota) serão atualizados."
            confirmText="Gravar"
            cancelText="Cancelar"
            variant="warning"
            onCancel={() => setResultFormConfirmOpen(false)}
            onConfirm={handleSaveResultConfirm}
          />
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
            <p className="text-sm text-gray-500">{effectiveTeamId ? 'Nenhum jogo com convocatória fechada.' : 'Sem dados disponíveis. Cria a tua primeira equipa para começar.'}</p>
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
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const url = buildWhatsAppShareUrl({
                            gameType: getCategoryFromPhase(game.phase),
                            opponentOrName: GamesService.formatOpponentDisplay(game.opponent) || game.opponent || 'Jogo',
                            startsAt: game.starts_at,
                            location: game.location || '',
                            gameId: game.id,
                          });
                          window.open(url, '_blank', 'noreferrer');
                        }}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-green-100 text-gray-600 hover:text-green-700 transition-colors shadow-sm"
                        aria-label="Partilhar no WhatsApp"
                        title="Partilhar no WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setGameToEdit(game);
                        }}
                        className="p-1.5 rounded-lg bg-white/90 hover:bg-gray-100 text-gray-600 hover:text-blue-600 transition-colors shadow-sm"
                        aria-label="Editar jogo"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
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
                                  {prefix}{pl.name} (Total: {totalRawPlayerPoints(pl)} pts){suffix}
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
                                  {prefix}{pl.name} (Total: {totalRawPlayerPoints(pl)} pts){suffix}
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
        </>
        )}

        <ConfirmDialog
          isOpen={!!gameToDelete}
          title="Eliminar convocatória"
          message="Tem a certeza que deseja eliminar esta convocatória? Esta ação não pode ser revertida."
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="danger"
          onConfirm={async () => {
            if (!gameToDelete?.id) return;
            setDeletingGameId(gameToDelete.id);
            try {
              await GamesService.delete(gameToDelete.id);
              if (selectedGame?.id === gameToDelete.id) setSelectedGame(null);
              setGameToDelete(null);
              await loadOpenGames();
              await loadClosedGames();
              await loadDashboard();
              showToast('Convocatória eliminada. A lista e o Ranking foram atualizados.', 'success');
            } catch (e) {
              showToast(e instanceof Error ? e.message : 'Erro ao eliminar convocatória.', 'error');
            } finally {
              setDeletingGameId(null);
            }
          }}
          onCancel={() => setGameToDelete(null)}
        />

        <EditGameModal
          isOpen={!!gameToEdit}
          game={gameToEdit}
          onClose={() => setGameToEdit(null)}
          onSuccess={async () => {
            await loadOpenGames();
            await loadClosedGames();
            await loadDashboard();
            showToast('Jogo atualizado com sucesso', 'success');
            setGameToEdit(null);
          }}
        />

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </Layout>
  );
}
