import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, CategoryCard, Button, Badge, Loading, Header, Toast, ToastType } from '../components/ui';
import { getCategoryFromPhase, CATEGORY_STYLES, GRID_CLASSES } from '../domain/categoryTheme';
import { useAuth, RESTRICTED_COORDINATION_MSG, RESTRICTED_ADMIN_MSG } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { GamesService } from '../services';
import { supabase } from '../lib/supabase';
import { OPEN_GAMES_INVALIDATE_EVENT } from '../lib/openGamesInvalidate';
import { Calendar, MapPin, Users, Trophy, UserCircle } from 'lucide-react';

type OpenGamesTab = 'liga' | 'outros';

export function HomeScreen({ accessDenied, accessDeniedAdmin }: { accessDenied?: boolean; accessDeniedAdmin?: boolean }) {
  const { user, session, player, isAdmin, loading: authLoading, refreshPlayer } = useAuth();
  const { route, navigate } = useNavigation();
  const profileRefreshedRef = useRef(false);

  const [openGames, setOpenGames] = useState<any[]>([]);
  const [openGamesTab, setOpenGamesTab] = useState<OpenGamesTab>('liga');
  const [gamesPlayed, setGamesPlayed] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const ligaGames = useMemo(
    () => openGames.filter((g) => getCategoryFromPhase(g.phase) === 'Liga'),
    [openGames]
  );
  const outrosGames = useMemo(
    () => openGames.filter((g) => getCategoryFromPhase(g.phase) !== 'Liga'),
    [openGames]
  );
  const filteredOpenGames = openGamesTab === 'liga' ? ligaGames : outrosGames;
  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  useEffect(() => {
    const onOpenGamesInvalidate = () => {
      void (async () => {
        try {
          const open = await GamesService.getOpenGames();
          setOpenGames(open ?? []);
        } catch {
          setOpenGames([]);
        }
      })();
    };
    window.addEventListener(OPEN_GAMES_INVALIDATE_EVENT, onOpenGamesInvalidate);
    return () => window.removeEventListener(OPEN_GAMES_INVALIDATE_EVENT, onOpenGamesInvalidate);
  }, []);

  useEffect(() => {
    if (accessDeniedAdmin || route.params?.accessDeniedAdmin) {
      showToast(RESTRICTED_ADMIN_MSG, 'error');
    } else if (accessDenied || route.params?.accessDenied) {
      showToast(RESTRICTED_COORDINATION_MSG, 'error');
    }
  }, [accessDenied, accessDeniedAdmin, route.params?.accessDenied, route.params?.accessDeniedAdmin]);

  // Reset refresh flag when session is lost (logout)
  useEffect(() => {
    if (!session) profileRefreshedRef.current = false;
  }, [session]);

  // Refresh perfil ao entrar no Início (garante role atualizado após correção RLS) e carrega jogos
  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user || !session) {
      setLoading(false);
      if (!user) navigate({ name: 'login' });
      return;
    }

    // Refresh do perfil uma vez por sessão para que Admin/Coordenador vejam os menus corretos
    if (!profileRefreshedRef.current) {
      profileRefreshedRef.current = true;
      void refreshPlayer();
    }

    if (!player) {
      setLoading(true);
      return;
    }

    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, session, user, player]);

  const loadData = async () => {
    setLoading(true);
    if (!player) {
      setLoading(false);
      return;
    }
    try {
      // Configuração inicial (equipas/jogos) assumida feita via Supabase; não mostrar card de Setup.
      try {
        const open = await GamesService.getOpenGames();
        setOpenGames(open ?? []);
        console.log('Jogos carregados na Home:', open ?? []);
      } catch (gamesErr) {
        console.error('[HomeScreen] loadData getOpenGames error:', {
          message: gamesErr instanceof Error ? gamesErr.message : String(gamesErr),
          full: gamesErr,
        });
        setOpenGames([]);
      }

      const { data: pairs, error: pairsError } = await supabase
        .from('pairs')
        .select('game_id, games!inner(id, status)')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`);

      if (pairsError) {
        console.error('[HomeScreen] loadData pairs error:', {
          message: pairsError.message,
          details: (pairsError as { details?: string }).details,
          hint: (pairsError as { hint?: string }).hint,
          code: (pairsError as { code?: string }).code,
          full: pairsError,
        });
        setGamesPlayed(0);
      } else {
        const completedGames = (pairs || []).filter((p: any) =>
          ['concluido', 'completed', 'final'].includes(p.games?.status ?? '')
        );
        setGamesPlayed(completedGames.length);
      }
    } catch (err) {
      console.error('[HomeScreen] loadData error:', {
        message: err instanceof Error ? err.message : String(err),
        full: err,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
      agendado: { variant: 'default', label: 'Agendado' },
      scheduled: { variant: 'default', label: 'Agendado' },
      convocatoria_aberta: { variant: 'success', label: 'Aberto' },
      open: { variant: 'success', label: 'Aberto' },
      convocatoria_fechada: { variant: 'warning', label: 'Fechado' },
      closed: { variant: 'danger', label: 'Cancelado' },
      concluido: { variant: 'success', label: 'Concluído' },
      completed: { variant: 'success', label: 'Concluído' },
      final: { variant: 'success', label: 'Concluído' },
    };
    const badge = badges[status] || { variant: 'default' as const, label: 'Agendado' };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <Header title="Início" />
        <div className="max-w-screen-sm mx-auto px-4 pt-4">
          <Loading text="A carregar..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Início" />
      <div className="max-w-screen-lg mx-auto px-4 pt-4 space-y-6">
        {!player && (
          <Card>
            <p className="text-sm text-gray-700 mb-3">Completa o teu perfil para aceder a todos os conteúdos.</p>
            <Button variant="primary" onClick={() => navigate({ name: 'complete-profile' })}>
              Ir para Perfil
            </Button>
          </Card>
        )}

        <CategoryCard category="Liga" header={<span className="font-semibold">O meu perfil</span>}>
          <div className="flex items-center gap-4">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-lg">
              <UserCircle className="w-8 h-8 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-gray-900 truncate">{player?.name || user?.email?.split('@')[0] || 'Jogador'}</h2>
                <Button size="sm" variant="ghost" onClick={() => navigate({ name: 'complete-profile' })}>
                  Perfil
                </Button>
              </div>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-semibold text-gray-700" title="Total acumulado dos jogos">
                    {player?.federation_points ?? 0} pts
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">{gamesPlayed} jogos</span>
                </div>
              </div>
            </div>
          </div>
        </CategoryCard>

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
            Consulta os jogos com convocatória aberta. Confirma a tua presença no Calendário.
          </p>

          {/* Tabs Liga M6 / Outros Eventos */}
          <div className="mb-4 p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpenGamesTab('liga')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  openGamesTab === 'liga'
                    ? 'bg-green-50 text-green-800 shadow-sm border-b-[3px] border-green-600 rounded-b-xl'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <span aria-hidden>🏆</span>
                <span>Liga M6</span>
                <span className="tabular-nums">({ligaGames.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setOpenGamesTab('outros')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  openGamesTab === 'outros'
                    ? 'bg-blue-50 text-blue-800 shadow-sm border-b-[3px] border-blue-600 rounded-b-xl'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <span aria-hidden>🎾</span>
                <span>Outros Eventos</span>
                <span className="tabular-nums">({outrosGames.length})</span>
              </button>
            </div>
          </div>

          {filteredOpenGames.length > 0 ? (
            <div className={GRID_CLASSES}>
              {filteredOpenGames.map((game: any) => {
                const cat = getCategoryFromPhase(game.phase);
                const styles = CATEGORY_STYLES[cat];
                return (
                  <div
                    key={game.id}
                    className="rounded-xl overflow-hidden shadow-lg border border-gray-100 flex flex-col"
                  >
                    <div className={`px-3 py-2 ${styles.headerGradient} text-white text-sm font-semibold flex items-center justify-between`}>
                      {GamesService.formatOpponentDisplay(game.opponent)}
                      {getStatusBadge(game.status)}
                    </div>
                    <div className="p-3 bg-white">
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{formatDate(game.starts_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{game.location}</span>
                      </div>
                      <Button
                        size="sm"
                        className={styles.buttonClasses + ' w-full'}
                        onClick={() => navigate({ name: 'game', params: { id: game.id }, state: { viewOnly: true } })}
                      >
                        Ver
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-600 font-medium">
                {openGames.length === 0
                  ? 'Sem jogos em aberto'
                  : openGamesTab === 'liga'
                    ? 'Sem jogos da Liga em aberto'
                    : 'Sem outros eventos em aberto'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {openGames.length === 0
                  ? 'Novos jogos aparecerão aqui quando criados'
                  : openGamesTab === 'liga'
                    ? 'Jogos de Qualificação, Regionais e Nacionais aparecerão aqui'
                    : 'Torneios, Mixes e Treinos aparecerão aqui'}
              </p>
            </div>
          )}
        </CategoryCard>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </Layout>
  );
}