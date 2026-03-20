/**
 * GameDetailsScreen — v2.0 FIX
 * Lista todas as duplas devolvidas pelo Supabase (4, 8, 10+ jogadores) — sem truncar a 3 duplas / 6 jogadores.
 * Resultados de sets só quando o jogo está fechado; pares carregam sempre que existirem.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Header, Loading, Toast, ToastType, Badge } from '../components/ui';
import { useNavigation } from '../contexts/NavigationContext';
import { supabase } from '../lib/supabase';
import { GamesService, PairsService, ResultsService, AvailabilitiesService } from '../services';
import { ArrowLeft, Calendar, Clock, MapPin, Users } from 'lucide-react';
import { getCategoryFromPhase } from '../domain/categoryTheme';
import { confirmedPairCountFromPlayers } from '../domain/registrationLimits';
import { buildGoogleCalendarUrl } from '../lib/shareLinks';

type ResultRow = {
  set1_casa: number;
  set1_fora: number;
  set2_casa: number;
  set2_fora: number;
  set3_casa: number | null;
  set3_fora: number | null;
};

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message: unknown }).message;
    return typeof m === 'string' ? m : String(m);
  }
  return String(e);
}

const CLOSED_STATUSES: readonly string[] = ['convocatoria_fechada', 'closed', 'concluido', 'completed', 'final'];

function isGameClosed(status: string | null | undefined): boolean {
  return CLOSED_STATUSES.includes(status ?? '');
}

type Props = {
  id?: string;
  viewOnly?: boolean;
};

function normalizeGameId(propId?: string, routeParam?: string): string | null {
  const a = propId != null ? String(propId).trim() : '';
  const b = routeParam != null ? String(routeParam).trim() : '';
  const v = a || b;
  return v ? v : null;
}

export function GameDetailsScreen({ id, viewOnly }: Props) {
  const { goBack, navigate } = useNavigation();
  const { id: idFromPath } = useParams<{ id: string }>();
  const gameId = normalizeGameId(id, idFromPath);

  const handleBack = () => (viewOnly ? navigate({ name: 'home' }) : goBack());

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<any>(null);
  const [pairs, setPairs] = useState<any[]>([]);
  const [confirmedPlayers, setConfirmedPlayers] = useState<any[]>([]);
  const [results, setResults] = useState<Record<string, ResultRow>>({});
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      showToast('Jogo inválido: falta o id', 'error');
      return;
    }

    const run = async () => {
      setLoading(true);
      try {
        const gamesCols =
          'id, status, opponent, starts_at, end_date, location, phase, round_number, team_points';
        const { data, error } = await supabase.from('games').select(gamesCols).eq('id', gameId).maybeSingle();

        if (error) throw error;
        setGame(data ?? null);
        if (!data) {
          showToast('Jogo não encontrado', 'error');
          setLoading(false);
          return;
        }

        const closed = isGameClosed(data.status);

        // Nunca deixar falhas em duplas/resultados/confirmados impedirem o cartão principal do jogo (RLS ou rede).
        let pairsData: any[] = [];
        try {
          const raw = await PairsService.getByGame(gameId);
          pairsData = Array.isArray(raw) ? raw : [];
        } catch (pe) {
          console.warn('[GameDetailsScreen] PairsService.getByGame:', pe);
        }
        setPairs(pairsData);

        if (closed) {
          let resRows: any[] = [];
          try {
            resRows = await ResultsService.getByGame(gameId);
          } catch (re) {
            console.warn('[GameDetailsScreen] ResultsService.getByGame:', re);
          }
          const resMap: Record<string, ResultRow> = {};
          for (const r of resRows ?? []) {
            const pid = (r as { pair_id?: string }).pair_id;
            if (pid) {
              resMap[pid] = {
                set1_casa: (r as any).set1_casa ?? 0,
                set1_fora: (r as any).set1_fora ?? 0,
                set2_casa: (r as any).set2_casa ?? 0,
                set2_fora: (r as any).set2_fora ?? 0,
                set3_casa: (r as any).set3_casa ?? null,
                set3_fora: (r as any).set3_fora ?? null,
              };
            }
          }
          setResults(resMap);
        } else {
          setResults({});
        }

        try {
          const players = await AvailabilitiesService.getConfirmedPlayers(gameId);
          setConfirmedPlayers(Array.isArray(players) ? players : []);
        } catch (ce) {
          console.warn('[GameDetailsScreen] getConfirmedPlayers:', ce);
          setConfirmedPlayers([]);
        }
      } catch (e) {
        console.error('[GameDetailsScreen] Erro ao carregar:', e);
        showToast(getErrorMessage(e), 'error');
        setGame(null);
        setPairs([]);
        setResults({});
        setConfirmedPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  const gameTitle = game ? GamesService.formatOpponentDisplay(game.opponent) || game.opponent || 'Jogo' : 'Jogo';

  const roundPhaseSubtitle = game
    ? (() => {
        const rn = Number(game.round_number);
        const label = `${GamesService.formatRoundName(Number.isFinite(rn) ? rn : 0, game.phase)} · ${game.phase ?? ''}`;
        return label.replace(/^Final\s*·\s*/i, '').trim() || String(game.phase ?? '').trim() || '';
      })()
    : '';

  const startsAt = game?.starts_at ? new Date(game.starts_at) : null;
  const dateStr = startsAt
    ? startsAt.toLocaleDateString('pt-PT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    : '—';
  const timeStr = startsAt ? startsAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—';

  const hasResults = Object.keys(results).length > 0;
  /** Só ações “extra”: calendário não faz sentido com jogo já fechado/concluído. Conteúdo principal não depende disto. */
  const showGoogleCalendar =
    !!game?.starts_at && !hasResults && game != null && !isGameClosed(game.status);
  const showActions = !viewOnly;

  if (loading) {
    return (
      <Layout>
        <Header title="Jogo" onBack={handleBack} />
        <div className="max-w-screen-sm mx-auto px-4 sm:px-6 pt-6">
          <Loading text="A carregar..." />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Header title="Jogo" onBack={handleBack} />

      <div className="max-w-screen-sm mx-auto px-4 sm:px-6 pt-4 pb-8 space-y-6">
        {!game ? (
          <Card>
            <p className="text-sm text-gray-700">Não foi possível carregar o jogo.</p>
            <div className="mt-4">
              <Button variant="outline" fullWidth onClick={handleBack} className="inline-flex items-center justify-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card padding="none" className="overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/30">
              <div className="flex min-h-[1px]">
                <div className="w-1 shrink-0 bg-emerald-500 rounded-l-2xl" aria-hidden />
                <div className="flex-1 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{gameTitle}</h2>
                      {roundPhaseSubtitle ? (
                        <p className="mt-1.5 text-sm font-medium text-[#1A237E]/90 leading-snug">{roundPhaseSubtitle}</p>
                      ) : null}
                    </div>
                    {game.status ? (
                      (() => {
                        const statusStr = String(game.status);
                        const isOpen = /aberta|aberto|open|pendente|pending/i.test(statusStr);
                        const isHistorical = /finalizado|concluido|final|completed/i.test(statusStr);
                        if (isOpen) {
                          return (
                            <span className="shrink-0 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              {statusStr}
                            </span>
                          );
                        }
                        if (isHistorical) {
                          return (
                            <span className="shrink-0 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-200 text-gray-700">
                              {statusStr}
                            </span>
                          );
                        }
                        return (
                          <Badge variant="default" className="shrink-0">
                            {statusStr}
                          </Badge>
                        );
                      })()
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3 text-gray-700">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="w-4 h-4 text-[#1A237E] shrink-0" aria-hidden />
                      <span className="text-sm leading-snug">{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-[#1A237E] shrink-0" aria-hidden />
                      <span className="text-sm leading-snug">{timeStr}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <MapPin className="w-4 h-4 text-[#1A237E] shrink-0" aria-hidden />
                      <span className="text-sm leading-snug">{game.location || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {showActions && showGoogleCalendar && (
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-700 mb-2">Adicionar ao calendário</p>
                <a
                  href={buildGoogleCalendarUrl({
                    gameType: getCategoryFromPhase(game.phase),
                    opponentOrName: gameTitle,
                    startsAt: game.starts_at,
                    endDate: (game as { end_date?: string | null }).end_date ?? undefined,
                    location: game.location || '',
                    gameId: game.id,
                  })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-3 py-4 px-5 bg-white border-2 border-gray-200 rounded-xl shadow-md hover:shadow-lg hover:border-blue-200 transition-all text-gray-800 hover:bg-blue-50/50 font-semibold text-base no-underline"
                >
                  <span className="flex shrink-0 w-8 h-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm" aria-hidden>
                    <span className="grid grid-cols-2 grid-rows-2 w-full h-full">
                      <span className="bg-[#4285F4]" />
                      <span className="bg-[#EA4335]" />
                      <span className="bg-[#FBBC05]" />
                      <span className="bg-[#34A853]" />
                    </span>
                  </span>
                  <span>Adicionar ao meu Google Calendar</span>
                </a>
              </div>
            )}

            {pairs.length > 0 && (
              <Card>
                <h3 className="text-base font-semibold text-gray-900 mb-3">
                  {isGameClosed(game.status) ? 'Duplas e resultado' : 'Duplas'}
                </h3>
                <div className="space-y-4">
                  {pairs.map((pair: any, idx: number) => {
                    const pairId = pair?.id ?? `idx-${idx}`;
                    const res = results[pairId as string];
                    const p1 = pair.player1?.name ?? '—';
                    const p2 = pair.player2?.name ?? '—';
                    let setsStr = '—';
                    let outcome: 'Vitória' | 'Derrota' | null = null;
                    if (res && (res.set1_casa != null || res.set1_fora != null)) {
                      const s1 = `${res.set1_casa ?? 0}-${res.set1_fora ?? 0}`;
                      const s2 = `${res.set2_casa ?? 0}-${res.set2_fora ?? 0}`;
                      const s3 =
                        res.set3_casa != null && res.set3_fora != null ? `${res.set3_casa}-${res.set3_fora}` : null;
                      setsStr = s3 ? `${s1}, ${s2}, ${s3}` : `${s1}, ${s2}`;
                      let setsWon = 0;
                      let setsLost = 0;
                      const isEmptySet = (c: number, f: number) => c === 0 && f === 0;
                      const count = (casa: number, fora: number) => {
                        if (isEmptySet(casa, fora)) return;
                        if (casa > fora) setsWon += 1;
                        else if (fora > casa) setsLost += 1;
                      };
                      count(res.set1_casa ?? 0, res.set1_fora ?? 0);
                      count(res.set2_casa ?? 0, res.set2_fora ?? 0);
                      if (res.set3_casa != null && res.set3_fora != null) count(res.set3_casa, res.set3_fora);
                      outcome = setsWon > setsLost ? 'Vitória' : 'Derrota';
                    }
                    return (
                      <div key={pairId} className="p-3 rounded-lg border border-gray-200 bg-gray-50/50">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">
                            Dupla {idx + 1}: {p1} + {p2}
                          </span>
                          {outcome ? (
                            <Badge variant={outcome === 'Vitória' ? 'success' : 'danger'} size="sm">
                              {outcome}
                            </Badge>
                          ) : null}
                        </div>
                        {setsStr !== '—' ? <p className="text-sm text-gray-600 mt-1">Sets: {setsStr}</p> : null}
                      </div>
                    );
                  })}
                </div>
                {game.team_points != null ? (
                  <p className="text-sm text-gray-600 mt-3">
                    <strong>Resultado da equipa:</strong> {game.team_points}{' '}
                    {game.team_points === 1 ? 'ponto' : 'pontos'} (jogo)
                  </p>
                ) : null}
              </Card>
            )}

            {/* Sempre mostrar secção de confirmados (conv. fechada / concluído incl.): lista pode estar vazia por RLS. */}
            <Card className="bg-gray-50/80 border border-gray-200/80 rounded-2xl">
              <p className="text-sm font-semibold text-amber-700 mb-2" role="status">
                {confirmedPlayers.length > 0 ? (
                  <>
                    🔥 {confirmedPlayers.length} Jogador{confirmedPlayers.length !== 1 ? 'es' : ''} Confirmado
                    {confirmedPlayers.length !== 1 ? 's' : ''}
                    <span className="block mt-1 text-xs font-medium text-gray-600">
                      {(() => {
                        const n = confirmedPairCountFromPlayers(confirmedPlayers.length);
                        return n === 1 ? '1 dupla inscrita' : `${n} duplas inscritas`;
                      })()}
                    </span>
                  </>
                ) : (
                  <span className="text-gray-700">Confirmados neste jogo</span>
                )}
              </p>
              <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-600" aria-hidden />
                Quem confirmou disponibilidade
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Jogadores que confirmaram presença nesta jornada (ou duplas fechadas — a lista depende das permissões).
              </p>
              {confirmedPlayers.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {confirmedPlayers.map((p: any, idx: number) => {
                    const name = p.name ?? '—';
                    const initials =
                      name
                        .split(/\s+/)
                        .map((s: string) => s[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase() || '?';
                    const hue = (idx * 137) % 360;
                    const bgColor = `hsl(${hue}, 55%, 45%)`;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-gray-100 shadow-sm min-w-0"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                          style={{ backgroundColor: bgColor }}
                          aria-hidden
                        >
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-gray-900 text-sm block truncate">{name}</span>
                          {p.federation_points != null ? (
                            <span className="text-[10px] text-gray-400">{p.federation_points} pts</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-2">
                  Sem jogadores listados aqui. Se a convocatória estiver fechada, vê as <strong>duplas</strong> acima; a
                  lista de confirmados pode estar limitada por permissões.
                </p>
              )}
            </Card>

            <div className="pt-2">
              <Button variant="outline" fullWidth onClick={handleBack} className="inline-flex items-center justify-center gap-2 py-3">
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </Button>
            </div>
          </>
        )}

        {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}
      </div>
    </Layout>
  );
}
