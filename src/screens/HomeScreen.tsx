import { useEffect, useState } from 'react';
import { Layout } from '../components/layout/Layout';
import { Card, CategoryCard, Button, Badge, Loading, Header, Toast, ToastType } from '../components/ui';
import { getCategoryFromPhase, CATEGORY_STYLES, GRID_CLASSES } from '../domain/categoryTheme';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { GamesService } from '../services';
import { supabase } from '../lib/supabase';
import { Calendar, MapPin, Users, Shield, Trophy, UserCircle } from 'lucide-react';

export function HomeScreen() {
  const { user, session, player, isAdmin, loading: authLoading } = useAuth();
  const { route, navigate } = useNavigation();

  const [openGames, setOpenGames] = useState<any[]>([]);
  const [gamesPlayed, setGamesPlayed] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showBootstrapPrompt, setShowBootstrapPrompt] = useState<boolean>(false);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  useEffect(() => {
    if (route.name === 'home' && route.params?.accessDenied) {
      showToast('Acesso Negado', 'error');
      navigate({ name: 'home' });
    }
  }, [route.name, route.params?.accessDenied]);

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

    // Jogador vai direto para a Home (sem redirecionamento para CompleteProfile)
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
      // Mostrar "Configuração Inicial" apenas quando este é o único jogador (primeiro utilizador do sistema).
      // Jogadores criados por um admin nunca são únicos — não devem ver a opção de se promover a admin.
      const { count: totalPlayers } = await supabase.from('players').select('id', { count: 'exact', head: true });
      setShowBootstrapPrompt((totalPlayers ?? 0) === 1);

      try {
        const open = await GamesService.getOpenGames();
        setOpenGames(open ?? []);
      } catch (gamesErr) {
        setOpenGames([]);
      }

      const { data: pairs, error: pairsError } = await supabase
        .from('pairs')
        .select('game_id, games!inner(id, status)')
        .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`);

      if (pairsError) {
        setGamesPlayed(0);
      } else {
        const completedGames = (pairs || []).filter((p: any) =>
          ['concluido', 'completed'].includes(p.games?.status ?? '')
        );
        setGamesPlayed(completedGames.length);
      }
    } catch (err) {
      console.error('[HomeScreen] loadData error:', err);
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
                  <span className="text-sm font-semibold text-gray-700">{player?.federation_points ?? 0} pts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-semibold text-gray-700">{gamesPlayed} jogos</span>
                </div>
              </div>
            </div>
          </div>
        </CategoryCard>

        {!isAdmin && showBootstrapPrompt && (
          <CategoryCard category="Liga" header={<span className="font-semibold flex items-center gap-2"><Shield className="w-5 h-5" /> Configuração Inicial</span>}>
            <div className="flex items-start gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Configuração Inicial</h3>
                <p className="text-xs text-gray-600 mb-3">Promova-se a Administrador para gerir equipas, jogos e utilizadores.</p>
                <Button size="sm" className={CATEGORY_STYLES.Liga.buttonClasses} onClick={() => navigate({ name: 'bootstrap' })}>
                  Configurar Sistema
                </Button>
              </div>
            </div>
          </CategoryCard>
        )}

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

          {openGames.length > 0 ? (
            <div className={GRID_CLASSES}>
              {openGames.map((game: any) => {
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
                        onClick={() => navigate({ name: 'game', params: { id: game.id } })}
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
              <p className="text-gray-600 font-medium">Sem jogos em aberto</p>
              <p className="text-xs text-gray-500 mt-1">Novos jogos aparecerão aqui quando criados</p>
            </div>
          )}
        </CategoryCard>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    </Layout>
  );
}