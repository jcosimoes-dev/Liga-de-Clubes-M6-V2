/**
 * GameDetailsScreen — v2.0 FIX
 * Sem verificação de role aqui: qualquer utilizador autenticado vê título, data, local, duplas (se houver) e confirmados.
 * (Editar / fechar convocatória / resultados ficam na Gestão Desportiva com permissões próprias.)
 * Lista todas as duplas devolvidas pelo Supabase; resultados de sets com jogo fechado.
 */
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { Card, Button, Header, Loading, Toast, ToastType, Badge } from '../components/ui';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { GamesService, PairsService, ResultsService, AvailabilitiesService } from '../services';
import { ArrowLeft, Calendar, Check, Clock, MapPin, Users } from 'lucide-react';
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

/** Fallback se props/React Router não trouxerem o id (ex.: hash "#/jogos/uuid"). */
function gameIdFromWindowHash(): string | null {
  if (typeof window === 'undefined') return null;
  const inner = (window.location.hash || '').replace(/^#/, '').split('?')[0];
  const m = inner.match(/(?:^|\/)jogos\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

export function GameDetailsScreen({ id, viewOnly }: Props) {
  const { goBack, navigate } = useNavigation();
  const { player } = useAuth();
  const { id: idFromPath } = useParams<{ id: string }>();
  const gameId = normalizeGameId(id, idFromPath || gameIdFromWindowHash());

  const handleBack = () => (viewOnly ? navigate({ name: 'home' }) : goBack());

  const [loading, setLoading] = useState(true);
  const [game, setGame] = useState<any>(null);
  const [pairs, setPairs] = useState<any[]>([]);
  /** Todos os jogadores com qualquer resposta de disponibilidade para este jogo */
  const [availPlayers, setAvailPlayers] = useState<{ id: string; name: string; status: string }[]>([]);
  const [results, setResults] = useState<Record<string, ResultRow>>({});
  const [savingAvail, setSavingAvail] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'success') => setToast({ message, type });

  // Derivado: jogadores que confirmaram (para manter compatibilidade com a secção de duplas fechadas)
  const confirmedPlayers = availPlayers.filter((p) => p.status === 'confirmed');
  const myAvailability = availPlayers.find((p) => p.id === String(player?.id ?? ''))?.status ?? null;

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

        // Carregar TODOS os jogadores que responderam (qualquer status)
        await loadAvailPlayers(gameId);
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

  const loadAvailPlayers = async (gId: string) => {
    try {
      // 1. Todas as disponibilidades do jogo
      const { data: avails, error: aErr } = await supabase
        .from('availabilities')
        .select('player_id, status')
        .eq('game_id', gId);
      if (aErr) throw aErr;
      const rows = avails ?? [];
      if (rows.length === 0) { setAvailPlayers([]); return; }

      // 2. Detalhes dos jogadores
      const pids = [...new Set(rows.map((r: any) => r.player_id as string).filter(Boolean))];
      const { data: playersRaw } = await supabase
        .from('players')
        .select('id, name')
        .in('id', pids);
      const nameMap: Record<string, string> = {};
      (playersRaw ?? []).forEach((p: any) => { nameMap[p.id] = p.name ?? '?'; });

      const merged = rows
        .map((r: any) => ({ id: r.player_id as string, name: nameMap[r.player_id] ?? '?', status: r.status as string }))
        .filter((r) => r.id && r.name !== '?');
      // Ordenar: confirmed primeiro, depois por nome
      merged.sort((a, b) => {
        if (a.status === 'confirmed' && b.status !== 'confirmed') return -1;
        if (b.status === 'confirmed' && a.status !== 'confirmed') return 1;
        return a.name.localeCompare(b.name);
      });
      setAvailPlayers(merged);
    } catch (e) {
      console.warn('[GameDetailsScreen] loadAvailPlayers:', e);
      setAvailPlayers([]);
    }
  };

  const handleAvailability = async (status: 'confirmed' | 'declined' | 'undecided') => {
    if (!player?.id || !gameId) return;
    setSavingAvail(true);
    try {
      await AvailabilitiesService.upsert({ game_id: gameId, player_id: String(player.id), status });
      showToast(status === 'confirmed' ? 'Presença confirmada!' : status === 'declined' ? 'Ausência registada.' : 'Resposta guardada.', 'success');
      await loadAvailPlayers(gameId);
    } catch (e) {
      showToast('Erro ao guardar disponibilidade', 'error');
    } finally {
      setSavingAvail(false);
    }
  };

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
  /** Só ações “extra”: calendário não faz sentido com jogo já fechado/concluído. */
  const showGoogleCalendar =
    !!game?.starts_at && !hasResults && game != null && !isGameClosed(game.status);
  const showActions = !viewOnly;

  const googleCalendarHref = useMemo(() => {
    if (!showActions || !showGoogleCalendar || !game) return '';
    try {
      return buildGoogleCalendarUrl({
        gameType: getCategoryFromPhase(game.phase),
        opponentOrName: gameTitle,
        startsAt: game.starts_at,
        endDate: (game as { end_date?: string | null }).end_date ?? undefined,
        location: game.location || '',
        gameId: game.id,
      });
    } catch (e) {
      console.warn('[GameDetailsScreen] buildGoogleCalendarUrl:', e);
      return '';
    }
  }, [showActions, showGoogleCalendar, game, gameTitle]);

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

            {googleCalendarHref ? (
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-700 mb-2">Adicionar ao calendário</p>
                <a
                  href={googleCalendarHref}
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
            ) : null}

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

            {/* Lista de disponibilidade — todos os jogadores que responderam, com checkbox */}
            {availPlayers.length > 0 && (
              <Card className="border border-gray-200/80 rounded-2xl">
                <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-600" aria-hidden />
                  Disponibilidade
                </h3>
                {confirmedPlayers.length > 0 && (
                  <p className="text-xs text-gray-500 mb-3">
                    🔥 {confirmedPlayers.length} confirmado{confirmedPlayers.length !== 1 ? 's' : ''} · {(() => { const n = confirmedPairCountFromPlayers(confirmedPlayers.length); return n === 1 ? '1 dupla' : `${n} duplas`; })()}
                  </p>
                )}
                <div className="space-y-2">
                  {availPlayers.map((p) => {
                    const isMe = p.id === String(player?.id ?? '');
                    const isConfirmed = p.status === 'confirmed';
                    const isDeclined = p.status === 'declined';
                    const initials = p.name.split(/\s+/).map((s: string) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
                    const canToggle = isMe && game && !isGameClosed(game.status) && new Date(game.starts_at) >= new Date();
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                          isConfirmed
                            ? 'bg-green-50 border-green-200'
                            : isDeclined
                            ? 'bg-red-50/40 border-red-100 opacity-60'
                            : 'bg-gray-50 border-gray-100'
                        } ${canToggle ? 'cursor-pointer hover:shadow-sm' : ''}`}
                        onClick={() => {
                          if (!canToggle || savingAvail) return;
                          handleAvailability(isConfirmed ? 'undecided' : 'confirmed');
                        }}
                      >
                        {/* Checkbox visual */}
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                          isConfirmed
                            ? 'bg-green-500 border-green-500'
                            : canToggle
                            ? 'border-gray-300 bg-white hover:border-green-400'
                            : 'border-gray-200 bg-gray-100'
                        }`}>
                          {isConfirmed && <Check className="w-3 h-3 text-white" />}
                        </div>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${
                          isConfirmed ? 'bg-green-600' : isDeclined ? 'bg-red-400' : 'bg-gray-400'
                        }`}>
                          {initials}
                        </div>
                        {/* Nome */}
                        <span className={`font-medium text-sm flex-1 ${isDeclined ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {p.name}{isMe ? ' (tu)' : ''}
                        </span>
                        {/* Estado */}
                        <span className={`text-xs font-medium shrink-0 ${
                          isConfirmed ? 'text-green-700' : isDeclined ? 'text-red-400' : 'text-yellow-600'
                        }`}>
                          {isConfirmed ? '✓ Confirmado' : isDeclined ? '✗ Recusou' : '? Talvez'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {player?.id && game && !isGameClosed(game.status) && new Date(game.starts_at) >= new Date() && (
                  <p className="text-xs text-gray-400 mt-3 text-center">
                    Clica no teu nome para confirmar ou cancelar presença
                  </p>
                )}
              </Card>
            )}

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
