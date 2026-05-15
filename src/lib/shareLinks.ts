/**
 * Geração de links para partilha (WhatsApp) e adicionar ao Google Calendar.
 * Sem APIs externas: apenas URLs com parâmetros preenchidos.
 */

import type { GameCategory } from '../domain/categoryTheme';
import { formatWhatsAppNumber } from './phone';

/** URL público da app para partilhas (WhatsApp, Google Calendar). Evita localhost nos links. */
const DEFAULT_PUBLIC_APP_URL = 'https://liga-clubes-m6.vercel.app';

function getPublicAppBase(): string {
  const raw = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_APP_URL?: string } }).env?.VITE_APP_URL) ?? '';
  const base = (typeof raw === 'string' ? raw : '').trim() || DEFAULT_PUBLIC_APP_URL;
  return base.replace(/\/+$/, '');
}

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

/** Formata data para YYYYMMDD (eventos dia inteiro). Usa UTC para evitar que o fuso altere o dia. */
function toGoogleCalendarDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Dia seguinte em UTC (para fim exclusivo do Google: evento 28-29 → fim 30). */
function nextDayUTC(d: Date): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** Formata data em PT para descrição (ex: "25 mar. 2025") */
function toLocaleDatePT(d: Date): string {
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Base da app (origem + pathname). Usado apenas para redirects em browser (ex.: getLoginUrl). */
function getAppBase(): string {
  if (typeof window === 'undefined') return getPublicAppBase();
  const origin = window.location.origin ?? '';
  const path = (window.location.pathname ?? '/').replace(/\/+$/, '') || '';
  return path && path !== '/' ? `${origin}${path}` : origin;
}

/**
 * Link para a página inicial da app (para partilhas).
 * Usa VITE_APP_URL ou https://liga-clubes-m6.vercel.app para que os links no WhatsApp/Calendar não usem localhost.
 * @param fromWhatsApp Se true, adiciona ?from=whatsapp.
 */
export function getAppBaseUrl(fromWhatsApp?: boolean): string {
  const base = getPublicAppBase();
  return fromWhatsApp ? `${base}?from=whatsapp` : base;
}

/**
 * Link para a página do jogo (para partilhas).
 * Usa o URL público da app (VITE_APP_URL ou default Vercel).
 * @param fromWhatsApp Se true, adiciona ?from=whatsapp para a App processar sem forçar redirect noutros separadores.
 */
export function getAppGameUrl(gameId: string, fromWhatsApp?: boolean): string {
  if (!gameId) return getPublicAppBase();
  const base = getPublicAppBase();
  const path = `${base}/jogos/${encodeURIComponent(String(gameId).trim())}`;
  return fromWhatsApp ? `${path}?from=whatsapp` : path;
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
  /** Data de fim (opcional); quando preenchida, evento multi-dia → Google Calendar em "Dia Inteiro" */
  endDate?: string | null;
  /** Local do jogo */
  location: string;
  /** ID do jogo (para link direto na app, se existir) */
  gameId?: string;
}

/**
 * Gera o URL do WhatsApp para partilhar o jogo.
 * Inclui: Tipo, Data, Hora, Local e link da app para confirmar presença.
 * @param phone Número do destinatário (opcional). Se válido, abre wa.me/NUMBER; senão wa.me (seletor geral).
 */
export function buildWhatsAppShareUrl(info: GameShareInfo, phone?: string | null): string {
  const d = typeof info.startsAt === 'string' ? new Date(info.startsAt) : info.startsAt;
  const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const appUrl = info.gameId ? getAppGameUrl(info.gameId, true) : getAppBaseUrl(true);
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
  const num = formatWhatsAppNumber(phone);
  const base = num ? `https://wa.me/${num}` : 'https://wa.me';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Gera o URL do WhatsApp para partilhar a convocatória (equivalente ao email).
 * Inclui: Tipo, Data, Hora, Local, link para adicionar ao Google Calendar e link da App.
 * @param phone Número do destinatário (opcional). Se válido, abre wa.me/NUMBER; senão wa.me.
 */
export function buildWhatsAppConvocationUrl(info: GameShareInfo, phone?: string | null): string {
  const d = typeof info.startsAt === 'string' ? new Date(info.startsAt) : info.startsAt;
  const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const appUrl = info.gameId ? getAppGameUrl(info.gameId, true) : getAppBaseUrl(true);
  const calendarUrl = buildGoogleCalendarUrl(info);
  const gameTypeLabel = String(info.gameType).trim() || 'Jogo';
  const opponent = String(info.opponentOrName).trim() || '—';
  const location = String(info.location).trim() || '—';

  const lines = [
    `*Convocatória*`,
    `*${gameTypeLabel}* — ${opponent}`,
    `📅 ${dateStr} às ${timeStr}`,
    `📍 ${location}`,
    '',
    `📆 Adicionar ao Google Calendar:`,
    calendarUrl,
    '',
    `✅ Confirmar presença na App: ${appUrl}`,
  ];
  const text = lines.join('\n');
  const num = formatWhatsAppNumber(phone);
  const base = num ? `https://wa.me/${num}` : 'https://wa.me';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Gera o URL do WhatsApp para enviar convocatória a um jogador (mensagem personalizada).
 * Inclui: saudação com nome, local, data/hora, link da App e link do Google Calendar.
 * @param phone Número do jogador (opcional). Se válido, abre wa.me/NUMBER; senão wa.me (seletor geral, sem erro ao clicar).
 */
export function buildWhatsAppConvocationToPlayerUrl(info: GameShareInfo, playerName: string, phone?: string | null): string {
  const d = typeof info.startsAt === 'string' ? new Date(info.startsAt) : info.startsAt;
  const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const appUrl = info.gameId ? getAppGameUrl(info.gameId, true) : getAppBaseUrl(true);
  const calendarUrl = buildGoogleCalendarUrl(info);
  const location = String(info.location).trim() || '—';
  const name = String(playerName).trim() || 'Jogador';

  const lines = [
    `Olá ${name}! 🎾 Estás convocado para o jogo no ${location}!`,
    '',
    `Data: ${dateStr} às ${timeStr}`,
    '',
    `Confirma a tua presença na App: ${appUrl}`,
    '',
    `Adiciona já ao teu calendário: ${calendarUrl}`,
  ];
  const text = lines.join('\n');
  const num = formatWhatsAppNumber(phone);
  const base = num ? `https://wa.me/${num}` : 'https://wa.me';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Gera o URL do WhatsApp para notificar um jogador da sua dupla (mensagem curta).
 * Mensagem: "Olá [Nome]! 🎾 Foste convocado para a [Dupla X] no jogo de [Data]. Confirma aqui: [URL]"
 * @param duplaLabel Ex.: "Dupla 1", "Dupla 2", "Dupla 3"
 */
export function buildWhatsAppDuplaConvocationUrl(
  info: GameShareInfo,
  playerName: string,
  duplaLabel: string,
  phone?: string | null
): string {
  const d = typeof info.startsAt === 'string' ? new Date(info.startsAt) : info.startsAt;
  const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const appUrl = info.gameId ? getAppGameUrl(info.gameId, true) : getAppBaseUrl(true);
  const name = String(playerName).trim() || 'Jogador';
  const dupla = String(duplaLabel).trim() || 'dupla';
  const text = `Olá ${name}! 🎾 Foste convocado para a ${dupla} no jogo de ${dateStr}. Confirma aqui: ${appUrl}`;
  const num = formatWhatsAppNumber(phone);
  const base = num ? `https://wa.me/${num}` : 'https://wa.me';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Gera o URL do WhatsApp para notificar um jogador de uma substituição de emergência.
 * Mensagem urgente com info do jogo e da dupla.
 */
export function buildWhatsAppEmergencySubUrl(
  info: GameShareInfo,
  playerName: string,
  duplaLabel: string,
  phone?: string | null
): string {
  const d = typeof info.startsAt === 'string' ? new Date(info.startsAt) : info.startsAt;
  const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const appUrl = info.gameId ? getAppGameUrl(info.gameId, true) : getAppBaseUrl(true);
  const name = String(playerName).trim() || 'Jogador';
  const dupla = String(duplaLabel).trim() || 'dupla';
  const opponent = String(info.opponentOrName).trim() || '—';
  const location = String(info.location).trim() || '—';

  const lines = [
    `Olá ${name}! 🚨 *Substituição de emergência!*`,
    '',
    `Foste convocado(a) para a *${dupla}*:`,
    `📅 ${dateStr} às ${timeStr}`,
    `🆚 ${opponent}`,
    `📍 ${location}`,
    '',
    `Confirma a tua presença na App: ${appUrl}`,
  ];
  const text = lines.join('\n');
  const num = formatWhatsAppNumber(phone);
  const base = num ? `https://wa.me/${num}` : 'https://wa.me';
  return `${base}?text=${encodeURIComponent(text)}`;
}

/**
 * Abre o WhatsApp via clique programático num anchor (mais fiável em mobile do que window.location.href).
 * O `noopener,noreferrer` evita o separador vazio ao voltar.
 */
export function openWhatsAppUrl(url: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Gera o URL do Google Calendar para criar um evento.
 * Base: https://calendar.google.com/calendar/render (obrigatório para abrir o formulário de evento).
 * O parâmetro dates tem de estar presente e correto; caso contrário o Google pode redirecionar para a página do Workspace.
 * - Com endDate (Torneio/Mix): dates estritamente YYYYMMDD/YYYYMMDD (Dia Inteiro). O Google exige que a data de fim seja o dia SEGUINTE ao último dia real para o bloco aparecer correto.
 * - Sem endDate: dates=YYYYMMDDTHHmmssZ/YYYYMMDDTHHmmssZ (UTC).
 */
export const buildGoogleCalendarUrl = (info: GameShareInfo): string => {
  const baseUrl = 'https://calendar.google.com/calendar/render';
  const title = `${String(info.gameType).trim() || 'Jogo'} - ${String(info.opponentOrName).trim() || 'Jogo'}`;
  const appUrl = info.gameId ? getAppGameUrl(info.gameId) : getAppBaseUrl();

  const startDate = typeof info.startsAt === 'string' ? new Date(info.startsAt) : info.startsAt;
  const endDateRaw = info.endDate && String(info.endDate).trim();
  const hasEndDate = endDateRaw.length > 0 && endDateRaw !== 'null' && endDateRaw !== 'undefined';

  let datesParam: string;
  if (hasEndDate && endDateRaw) {
    const startStr = toGoogleCalendarDateOnly(startDate);
    const lastDay = new Date(endDateRaw);
    const dayAfterLast = nextDayUTC(lastDay);
    const endStr = toGoogleCalendarDateOnly(dayAfterLast);
    datesParam = `${startStr}/${endStr}`;
  } else {
    const start = toGoogleCalendarDateUTC(startDate);
    const end = toGoogleCalendarDateUTC(new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_MS));
    datesParam = `${start}/${end}`;
  }

  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = endDateRaw ? new Date(endDateRaw) : startDay;
  const periodStr = hasEndDate && endDateRaw
    ? `Período: ${startDay.getDate()}/${String(startDay.getMonth() + 1).padStart(2, '0')}/${startDay.getFullYear()} a ${endDay.getDate()}/${String(endDay.getMonth() + 1).padStart(2, '0')}/${endDay.getFullYear()}. `
    : '';
  const details = `${periodStr}Confirmar presença na App: ${appUrl}`;

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', title);
  params.set('dates', datesParam);
  params.set('details', details);
  params.set('location', info.location || '');

  return `${baseUrl}?${params.toString()}`;
};

/** Abre o URL do Google Calendar numa nova janela/tab */
export function openGoogleCalendar(info: GameShareInfo): void {
  const url = buildGoogleCalendarUrl(info);
  console.log('Link Google:', url);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) console.warn('[openGoogleCalendar] window.open bloqueado (popup?). URL para copiar:', url);
}
