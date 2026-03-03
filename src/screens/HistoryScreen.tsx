import { useState, useEffect, useMemo } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, CategoryCard, Badge, Loading, Header, Button } from '../components/ui';
import { getCategoryFromPhase, CATEGORY_STYLES, GRID_CLASSES } from '../domain/categoryTheme';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { GamesService, ResultsService } from '../services';
import { Calendar, MapPin, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import type { Database } from '../lib/database.types';

type Game = Database['public']['Tables']['games']['Row'];

export type GameTypeFilter = 'all' | 'Liga' | 'Torneio' | 'Mix' | 'Treino';

interface GameSummary {
  totalSetsWon: number;
  totalSetsLost: number;
  pairsWithResults: number;
  outcome: 'Vitória' | 'Derrota';
}

interface GameWithResult extends Game {
  result?: GameSummary;
}

/** Normaliza phase da BD para o filtro (Liga, Torneio, Mix, Treino). */
function getGameType(phase: string | null | undefined): GameTypeFilter {
  if (!phase) return 'Liga';
  const p = phase.trim();
  if (p === 'Qualificação' || p === 'Regionais' || p === 'Nacionais') return 'Liga';
  if (p === 'Treino') return 'Treino';
  if (p === 'Torneio' || p.includes('Quartos') || p.includes('Meia') || p === 'Final') return 'Torneio';
  if (p === 'Mix') return 'Mix';
  const lower = p.toLowerCase();
  if (lower.includes('treino')) return 'Treino';
  if (lower.includes('qualificação') || lower.includes('regionais') || lower.includes('nacionais')) return 'Liga';
  if (lower.includes('torneio') || lower.includes('quartos') || lower.includes('meia') || lower === 'final') return 'Torneio';
  if (lower.includes('mix')) return 'Mix';
  return 'Liga';
}

export function HistoryScreen() {
  const { player } = useAuth();
  const { navigate } = useNavigation();
  const [games, setGames] = useState<GameWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<GameTypeFilter>('all');

  useEffect(() => {
    loadHistory();
  }, [player]);

  const loadHistory = async () => {
    if (!player) return;

    try {
      setLoading(true);
      const allGames = await GamesService.getAll();

      const completedGames = allGames.filter((game) =>
        ['concluido', 'completed'].includes(game.status)
      );

      const gamesWithResults = await Promise.all(
        completedGames.map(async (game) => {
          try {
            const result = await ResultsService.getGameSummary(game.id);
            return { ...game, result };
          } catch (error) {
            console.error('Erro ao carregar resultado:', error);
            return game;
          }
        })
      );

      gamesWithResults.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
      setGames(gamesWithResults);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGames = useMemo(() => {
    if (typeFilter === 'all') return games;
    return games.filter(g => getGameType(g.phase) === typeFilter);
  }, [games, typeFilter]);

  const stats = useMemo(() => {
    const withResult = filteredGames.filter(g => g.result);
    const wins = withResult.filter(g => g.result!.outcome === 'Vitória').length;
    const losses = withResult.filter(g => g.result!.outcome === 'Derrota').length;
    return { wins, losses, total: withResult.length };
  }, [filteredGames]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getResultBadge = (game: GameWithResult) => {
    if (!game.result) {
      return <Badge variant="gray">Sem resultado</Badge>;
    }

    const { outcome } = game.result;

    if (outcome === 'Vitória') {
      return (
        <Badge variant="green" className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Vitória
        </Badge>
      );
    } else {
      return (
        <Badge variant="red" className="flex items-center gap-1">
          <TrendingDown className="w-3 h-3" />
          Derrota
        </Badge>
      );
    }
  };

  const getScoreDisplay = (game: GameWithResult) => {
    if (!game.result) return null;

    const { totalSetsWon, totalSetsLost } = game.result;
    return (
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">{totalSetsWon}</div>
          <div className="text-xs text-gray-600 mt-1">Sets ganhos</div>
        </div>
        <div className="text-2xl font-bold text-gray-400">-</div>
        <div className="text-center">
          <div className="text-3xl font-bold text-red-600">{totalSetsLost}</div>
          <div className="text-xs text-gray-600 mt-1">Sets perdidos</div>
        </div>
      </div>
    );
  };

  const typeTabs: { value: GameTypeFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'Liga', label: 'Liga' },
    { value: 'Torneio', label: 'Torneio' },
    { value: 'Mix', label: 'Mix' },
    { value: 'Treino', label: 'Treino' },
  ];

  if (loading) {
    return (
      <Layout>
        <Header title="Histórico" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4 flex items-center justify-center min-h-[50vh]">
          <Loading text="A carregar histórico..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Histórico" />
      <div className="max-w-screen-lg mx-auto px-4 pt-4 pb-6 space-y-6">
        <p className="text-sm font-medium text-gray-700 mb-2">Filtrar por game_type</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
          {typeTabs.map((tab) => {
            const isActive = typeFilter === tab.value;
            const cat = tab.value === 'all' ? 'Liga' : tab.value;
            const styles = CATEGORY_STYLES[cat as keyof typeof CATEGORY_STYLES];
            return (
              <button
                key={tab.value}
                onClick={() => setTypeFilter(tab.value)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  isActive ? (styles?.buttonClasses ?? 'bg-blue-600 text-white shadow-md') : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <CategoryCard
          category="Liga"
          header={
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Estatísticas da Época
            </div>
          }
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-600 mt-1">Total</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{stats.wins}</div>
              <div className="text-sm text-gray-600 mt-1">Vitórias</div>
            </div>
            <div className="text-center p-3 bg-red-50 rounded-lg">
              <div className="text-3xl font-bold text-red-600">{stats.losses}</div>
              <div className="text-sm text-gray-600 mt-1">Derrotas</div>
            </div>
          </div>

          {stats.total > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Taxa de vitórias: <span className="font-semibold text-gray-900">
                  {((stats.wins / stats.total) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          )}
        </CategoryCard>

        <div className={GRID_CLASSES}>
          {filteredGames.length === 0 ? (
            <Card className="col-span-full">
              <div className="text-center py-8">
                <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">
                  {games.length === 0 ? 'Ainda não há jogos realizados' : 'Nenhum jogo neste filtro'}
                </p>
              </div>
            </Card>
          ) : (
            filteredGames.map((game) => {
              const cat = getCategoryFromPhase(game.phase);
              const styles = CATEGORY_STYLES[cat];
              return (
                <CategoryCard
                  key={game.id}
                  category={cat}
                  header={
                    <div className="flex items-center justify-between w-full">
                      <span className="font-semibold">
                        {GamesService.formatRoundName(game.round_number)} · {GamesService.formatOpponentDisplay(game.opponent)}
                      </span>
                      {getResultBadge(game)}
                    </div>
                  }
                  className="cursor-pointer hover:shadow-xl transition-shadow"
                  onClick={() => navigate({ name: 'game', params: { id: game.id } })}
                >
                  <div className="space-y-3">
                    {game.result && (
                      <div className="flex items-center justify-center py-2">
                        {getScoreDisplay(game)}
                      </div>
                    )}

                    {game.team_points !== null && game.team_points !== undefined && (
                      <div className="flex items-center justify-center py-2">
                        <div className={`px-4 py-2 ${styles.iconBg} rounded-lg`}>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-4 h-4" />
                            <span className="text-sm font-semibold">
                              {game.team_points} {game.team_points === 1 ? 'ponto' : 'pontos'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(game.starts_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{game.location}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      fullWidth
                      className={styles.buttonClasses}
                      onClick={() => navigate({ name: 'game', params: { id: game.id } })}
                    >
                      Ver detalhes
                    </Button>
                  </div>
                </CategoryCard>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
