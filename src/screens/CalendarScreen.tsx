import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, CategoryCard, Badge, Loading, Button, Header, Toast, ToastType } from '../components/ui';
import { getCategoryFromPhase, CATEGORY_STYLES, GRID_CLASSES } from '../domain/categoryTheme';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { GamesService, AvailabilitiesService } from '../services';
import { Calendar, MapPin, Users, CheckCircle, HelpCircle, XCircle, Clock, Check } from 'lucide-react';

type AvailabilityStatus = 'confirmed' | 'declined' | 'undecided';

export function CalendarScreen() {
  const { navigate } = useNavigation();
  const { player } = useAuth();
  const [games, setGames] = useState<any[]>([]);
  const [filteredGames, setFilteredGames] = useState<any[]>([]);
  const [availabilities, setAvailabilities] = useState<Record<string, any>>({});
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [savingFor, setSavingFor] = useState<string | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [games, statusFilter, phaseFilter]);

  const gamesForList = selectedDate
    ? filteredGames.filter((g) => gameCoversDate(g, selectedDate))
    : filteredGames;

  const loadData = async () => {
    try {
      const gamesData = await GamesService.getAll();
      const notCompleted = gamesData.filter(
        (game) =>
          !['concluido', 'completed', 'closed', 'final'].includes(game.status)
      );
      const sorted = notCompleted.sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
      );
      setGames(sorted);

      const availsData = await AvailabilitiesService.getAll();
      const availsMap: Record<string, any> = {};
      availsData.forEach((avail) => {
        const key = `${avail.game_id}-${avail.player_id}`;
        availsMap[key] = avail;
      });
      setAvailabilities(availsMap);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...games];

    if (statusFilter !== 'all') {
      filtered = filtered.filter((g) => g.status === statusFilter);
    }

    if (phaseFilter !== 'all') {
      filtered = filtered.filter((g) => g.phase === phaseFilter);
    }

    setFilteredGames(filtered);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-PT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('pt-PT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
    const end = new Date(endDate).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
    return `${start} – ${end}`;
  };

  /** True se o dia (date) está entre a data de início e a data de fim do jogo (inclusive). */
  const gameCoversDate = (game: any, date: Date): boolean => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const start = new Date(game.starts_at);
    const gameStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const gameEnd = game.end_date
      ? new Date(new Date(game.end_date).getFullYear(), new Date(game.end_date).getMonth(), new Date(game.end_date).getDate())
      : gameStart;
    return d >= gameStart && d <= gameEnd;
  };

  const getDaysUntilGame = (gameDate: string): number => {
    const now = new Date();
    const game = new Date(gameDate);
    const diffTime = game.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getConfirmedCount = (gameId: string): number => {
    return Object.values(availabilities).filter(
      (avail) => avail.game_id === gameId && (avail.status === 'confirmed' || avail.status === 'confirmo')
    ).length;
  };

  const getMyAvailability = (gameId: string) => {
    if (!player) return null;
    return availabilities[`${gameId}-${player.id}`];
  };

  const handleAvailability = async (gameId: string, status: AvailabilityStatus) => {
    if (!player?.id) {
      showToast('Erro: Jogador não encontrado', 'error');
      return;
    }
    const playerId = String(player.id);
    const gameIdStr = String(gameId);
    if (!gameIdStr || !playerId) {
      showToast('Erro: ID de jogo ou jogador inválido', 'error');
      return;
    }

    const actionKey = `${gameIdStr}-${playerId}`;
    setSavingFor(actionKey);

    const statusLower = String(status).toLowerCase();
    const payload = { game_id: gameIdStr, player_id: playerId, status: statusLower };
    console.log('[CalendarScreen] Payload disponibilidade antes do upsert:', payload);

    if (gameIdStr === 'undefined' || gameIdStr === 'null' || playerId === 'undefined' || playerId === 'null') {
      showToast('Erro: IDs inválidos (undefined/null)', 'error');
      setSavingFor(null);
      return;
    }

    try {
      await AvailabilitiesService.upsert(payload);
      setAvailabilities((prev) => {
        const next = { ...prev };
        next[actionKey] = { ...(prev[actionKey] || {}), game_id: gameIdStr, player_id: playerId, status: statusLower };
        return next;
      });
      await loadData();
      showToast('Disponibilidade gravada com sucesso', 'success');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido';
      showToast(`Erro ao gravar: ${msg}`, 'error');
    } finally {
      setSavingFor(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
      agendado: { variant: 'default', label: 'Agendado' },
      scheduled: { variant: 'default', label: 'Agendado' },
      convocatoria_aberta: { variant: 'success', label: 'Aberto' },
      open: { variant: 'success', label: 'Aberto' },
      convocatoria_fechada: { variant: 'info', label: 'Fechado' },
      closed: { variant: 'danger', label: 'Cancelado' },
      concluido: { variant: 'default', label: 'Concluído' },
      completed: { variant: 'default', label: 'Concluído' },
      final: { variant: 'default', label: 'Concluído' },
    };
    const badge = badges[status] || { variant: 'default' as const, label: 'Agendado' };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcomingGames = gamesForList.filter((game) => {
    const end = game.end_date ? new Date(game.end_date) : new Date(game.starts_at);
    end.setHours(23, 59, 59, 999);
    return end >= now;
  });
  const pastGames = gamesForList.filter((game) => {
    const end = game.end_date ? new Date(game.end_date) : new Date(game.starts_at);
    end.setHours(23, 59, 59, 999);
    return end < now;
  });

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const calendarYear = calendarMonth.year;
  const calendarMonthIndex = calendarMonth.month;
  const firstDay = new Date(calendarYear, calendarMonthIndex, 1);
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  const hasEventOnDay = (day: number) => {
    const d = new Date(calendarYear, calendarMonthIndex, day);
    return games.some((g) => gameCoversDate(g, d));
  };
  const isSelectedDay = (day: number) =>
    selectedDate &&
    selectedDate.getFullYear() === calendarYear &&
    selectedDate.getMonth() === calendarMonthIndex &&
    selectedDate.getDate() === day;

  if (loading) {
    return (
      <Layout>
        <Header title="Calendário" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4">
          <Loading text="A carregar jogos..." />
        </div>
      </Layout>
    );
  }

  const renderGameCard = (game: any) => {
    const myAvail = getMyAvailability(game.id);
    const confirmedCount = getConfirmedCount(game.id);
    const daysUntil = getDaysUntilGame(game.starts_at);
    const isUpcoming = daysUntil >= 0;
    const isMultiDay = GamesService.isMultiDay(game);
    const cat = getCategoryFromPhase(game.phase);
    const styles = CATEGORY_STYLES[cat];

    return (
      <CategoryCard
        key={game.id}
        category={isMultiDay ? 'Liga' : cat}
        header={
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-semibold">
              {(() => {
                const label = `${GamesService.formatRoundName(game.round_number)} · ${game.phase}`;
                return label.replace(/^Final\s*·\s*/i, '').trim() || game.phase || 'Jogo';
              })()}
            </span>
            {getStatusBadge(game.status)}
          </div>
        }
        className={`hover:shadow-xl transition-shadow ${isMultiDay ? 'ring-2 ring-blue-900/30' : ''}`}
      >
        {isMultiDay && (
          <div className="mb-3 -mx-4 -mt-2 px-4 py-2 rounded-t-lg bg-gradient-to-r from-blue-900 to-blue-800 text-white text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>{formatDateRange(game.starts_at, game.end_date)}</span>
          </div>
        )}
        <div className="space-y-4">
          <div className="space-y-2">
            {!isMultiDay && (
            <div className="flex items-baseline gap-3">
              <Calendar className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-lg font-bold text-gray-900">{formatDate(game.starts_at)}</div>
                <div className="text-sm text-gray-600">{formatTime(game.starts_at)}</div>
              </div>
            </div>
            )}

            <div className="flex items-center gap-3 py-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isMultiDay ? 'bg-blue-100' : 'bg-gray-200'}`}>
                <Users className={`w-5 h-5 ${isMultiDay ? 'text-blue-700' : 'text-gray-600'}`} />
              </div>
              <span className="text-lg font-bold text-gray-900">{GamesService.formatOpponentDisplay(game.opponent)}</span>
            </div>

            <div className="flex items-center gap-3 text-gray-600">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{game.location}</span>
            </div>
          </div>

          {isUpcoming && ['convocatoria_aberta', 'open'].includes(game.status) && (
            <div className="pt-3 border-t border-gray-200 space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAvailability(game.id, 'confirmed');
                  }}
                  disabled={savingFor === `${game.id}-${player?.id}`}
                  className={`flex flex-col items-center py-2 px-1 rounded-lg border-2 transition-all relative ${
                    myAvail?.status === 'confirmed'
                      ? 'bg-green-50 border-green-500 text-green-700 ring-2 ring-green-300'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-green-300'
                  } disabled:opacity-70`}
                >
                  {myAvail?.status === 'confirmed' ? (
                    <Check className="w-5 h-5 mb-1 text-green-600" />
                  ) : (
                    <CheckCircle className="w-5 h-5 mb-1" />
                  )}
                  <span className="text-xs font-medium">Confirmar</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAvailability(game.id, 'undecided');
                  }}
                  disabled={savingFor === `${game.id}-${player?.id}`}
                  className={`flex flex-col items-center py-2 px-1 rounded-lg border-2 transition-all ${
                    myAvail?.status === 'undecided'
                      ? 'bg-yellow-50 border-yellow-500 text-yellow-700 ring-2 ring-yellow-300'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-yellow-300'
                  } disabled:opacity-70`}
                >
                  {myAvail?.status === 'undecided' ? (
                    <Check className="w-5 h-5 mb-1 text-yellow-600" />
                  ) : (
                    <HelpCircle className="w-5 h-5 mb-1" />
                  )}
                  <span className="text-xs font-medium">Talvez</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAvailability(game.id, 'declined');
                  }}
                  disabled={savingFor === `${game.id}-${player?.id}`}
                  className={`flex flex-col items-center py-2 px-1 rounded-lg border-2 transition-all ${
                    myAvail?.status === 'declined'
                      ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-300'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-red-300'
                  } disabled:opacity-70`}
                >
                  {myAvail?.status === 'declined' ? (
                    <Check className="w-5 h-5 mb-1 text-red-600" />
                  ) : (
                    <XCircle className="w-5 h-5 mb-1" />
                  )}
                  <span className="text-xs font-medium">Recusar</span>
                </button>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              <span>{confirmedCount} confirmados</span>
            </div>
            {isUpcoming && daysUntil > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {daysUntil === 0 ? 'Hoje' : daysUntil === 1 ? 'Amanhã' : `${daysUntil} dias`}
                </span>
              </div>
            )}
          </div>

          <Button
            fullWidth
            size="sm"
            className={styles.buttonClasses}
            onClick={() => navigate({ name: 'game', params: { id: game.id } })}
          >
            Ver detalhes
          </Button>
        </div>
      </CategoryCard>
    );
  };

  const monthLabel = new Date(calendarYear, calendarMonthIndex).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });

  return (
    <Layout>
      <Header title="Calendário" />
      <div className="max-w-screen-lg mx-auto px-4 pt-4 space-y-6">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800 capitalize">{monthLabel}</h3>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }))
                }
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="Mês anterior"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() });
                }}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 text-xs"
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() =>
                  setCalendarMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }))
                }
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="Mês seguinte"
              >
                →
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-gray-500 mb-1">
            {weekDays.map((w) => (
              <div key={w} className="py-1 font-medium">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((day, idx) =>
              day === null ? (
                <div key={`e-${idx}`} className="aspect-square" />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelectedDate(new Date(calendarYear, calendarMonthIndex, day))}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors min-h-[2.5rem] ${
                    isSelectedDay(day)
                      ? 'bg-blue-600 text-white font-bold ring-2 ring-blue-400'
                      : hasEventOnDay(day)
                        ? 'bg-blue-50/80 text-gray-900 hover:bg-blue-100'
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span>{day}</span>
                  {hasEventOnDay(day) && !isSelectedDay(day) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-0.5" aria-hidden />
                  )}
                </button>
              )
            )}
          </div>
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="mt-3 w-full py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
            >
              Ver todos os dias
            </button>
          )}
        </Card>

        <div className="space-y-3">
          {selectedDate && (
            <p className="text-sm text-gray-600">
              A mostrar jogos do dia{' '}
              <strong>{selectedDate.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
            </p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-r from-blue-900 to-red-800 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter('convocatoria_aberta')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === 'convocatoria_aberta'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Abertos
            </button>
            <button
              onClick={() => setStatusFilter('convocatoria_fechada')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === 'convocatoria_fechada'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Fechados
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            <button
              onClick={() => setPhaseFilter('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                phaseFilter === 'all'
                  ? 'bg-gradient-to-r from-blue-900 to-red-800 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas as fases
            </button>
            <button
              onClick={() => setPhaseFilter('Qualificação')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                phaseFilter === 'Qualificação'
                  ? 'bg-gradient-to-r from-blue-900 to-red-800 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Qualificação
            </button>
            <button
              onClick={() => setPhaseFilter('Regionais')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                phaseFilter === 'Regionais'
                  ? 'bg-gradient-to-r from-blue-900 to-red-800 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Regionais
            </button>
            <button
              onClick={() => setPhaseFilter('Nacionais')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                phaseFilter === 'Nacionais'
                  ? 'bg-gradient-to-r from-blue-900 to-red-800 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Nacionais
            </button>
          </div>
        </div>

        {upcomingGames.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Próximos Jogos
            </h2>
            <div className={GRID_CLASSES}>
              {upcomingGames.map(renderGameCard)}
            </div>
          </div>
        )}

        {pastGames.length > 0 && (
          <div className="space-y-3 pt-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-500" />
              Jogos Passados
            </h2>
            <div className={GRID_CLASSES}>
              {pastGames.map(renderGameCard)}
            </div>
          </div>
        )}

        {gamesForList.length === 0 && (
          <Card>
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">
                {selectedDate ? 'Sem jogos neste dia' : 'Sem jogos'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {selectedDate ? 'Nenhum jogo cai neste dia. Clica noutro dia ou em "Ver todos os dias".' : 'Nenhum jogo corresponde aos filtros'}
              </p>
            </div>
          </Card>
        )}

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </Layout>
  );
}
