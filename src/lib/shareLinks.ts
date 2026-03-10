/**
 * Geração de links para partilha (WhatsApp) e adicionar ao Google Calendar.
 * Sem APIs externas: apenas URLs com parâmetros preenchidos.
 */

import type { GameCategory } from '../domain/categoryTheme';

/** Formata data para o formato exigido pelo Google Calendar (UTC): YYYYMMDDTHHmmssZ */
function toGoogleCalendarDateUTC(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  const sec = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${sec}Z`;
}

/** Base da app (origem + pathname sem trailing slash, ou só origem se pathname for /) */
function getAppBase(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin ?? '';
  const path = (window.location.pathname ?? '/').replace(/\/+$/, '') || '';
  return path && path !== '/' ? `${origin}${path}` : origin;
}

/** Link para a página inicial da app */
export function getAppBaseUrl(): string {
  return getAppBase();
}

/** Link para a página específica do jogo (ex: /jogos/[id]) para confirmar presença */
export function getAppGameUrl(gameId: string): string {
  if (!gameId || typeof window === 'undefined') return getAppBase();
  const base = getAppBase();
  return `${base}/jogos/${encodeURIComponent(String(gameId).trim())}`;
}

/** URL absoluta do ecrã de Login (raiz da app, não a página atual). Usar após logout para redirect. */
export function getLoginUrl(): string {
  if (typeof window === 'undefined') return '/login';
  const origin = window.location.origin ?? '';
  const basePath = (typeof import.meta !== 'undefined' && (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL) || '/';
  const base = basePath.replace(/\/+$/, '') || '';
  return base ? `${origin}${base}/login` : `${origin}/login`;
}

/** Duração padrão do evento no calendário (1h30 em ms) */
const DEFAULT_EVENT_DURATION_MS = 90 * 60 * 1000;

export interface GameShareInfo {
  /** Tipo/categoria: Liga, Torneio, Mix, Treino */
  gameType: GameCategory | string;
  /** Nome do adversário ou do evento (ex: "Raquet Center") */
  opponentOrName: string;
  /** Data/hora do jogo (ISO string ou Date) */
  startsAt: string | Date;
  /** Local do jogo */
  location: string;
  /** ID do jogo (para link direto na app, se existir) */
  gameId?: string;
}

/**
 * Gera o URL do WhatsApp para partilhar o jogo.
 * Inclui: Tipo, Data, Hora, Local e link da app para confirmar presença.
 */
export function buildWhatsAppShareUrl(info: GameShareInfo): string {
  const d = typeof info.startsAt === 'string' ? new Date(info.startsAt) : info.startsAt;
  const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const appUrl = info.gameId ? getAppGameUrl(info.gameId) : getAppBaseUrl();
  const gameTypeLabel = String(info.gameType).trim() || 'Jogo';
  const opponent = String(info.opponentOrName).trim() || '—';
  const location = String(info.location).trim() || '—';

  const lines = [
    `*${gameTypeLabel}* — ${opponent}`,
    `📅 ${dateStr} às ${timeStr}`,
    `📍 ${location}`,
    '',
    `Confirmar presença na App: ${appUrl}`,
  ];
  const text = lines.join('\n');
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Gera o URL do Google Calendar para adicionar o evento.
 * Abrir em nova janela. Datas em UTC para o Google aceitar sem erros.
 */
export function buildGoogleCalendarUrl(info: GameShareInfo): string {
  const start = typeof info.startsAt === 'string' ? new Date(info.startsAt) : info.startsAt;
  const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);

  const startUTC = toGoogleCalendarDateUTC(start);
  const endUTC = toGoogleCalendarDateUTC(end);

  const gameTypeLabel = String(info.gameType).trim() || 'Jogo';
  const title = `${gameTypeLabel} - ${String(info.opponentOrName).trim() || 'Jogo'}`;
  const appUrl = info.gameId ? getAppGameUrl(info.gameId) : getAppBaseUrl();
  const details = `Confirmar presença na App: ${appUrl}`;
  const location = String(info.location).trim() || '';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startUTC}/${endUTC}`,
    details: details,
    location: location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Abre o URL do Google Calendar numa nova janela/tab */
export function openGoogleCalendar(info: GameShareInfo): void {
  const url = buildGoogleCalendarUrl(info);
  window.open(url, '_blank', 'noopener,noreferrer');
}
