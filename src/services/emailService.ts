/**
 * Serviço de envio de emails (convocatórias).
 * Chama o endpoint /api/send-convocation que usa Resend no servidor (API key não exposta).
 */

export interface ConvocationEmailPayload {
  to: string;
  playerName: string;
  gameTitle: string;
  gameDate: string;
  gameTime: string;
  gameLocation: string;
  appUrl: string;
  calendarUrl: string;
}

const DEFAULT_FROM = 'onboarding@resend.dev';

/**
 * Envia email de convocatória ao jogador com template HTML e botão "Adicionar ao Google Calendar".
 * Requer endpoint serverless (ex.: Vercel /api/send-convocation) com RESEND_API_KEY.
 */
export async function sendConvocationEmail(payload: ConvocationEmailPayload): Promise<{ ok: boolean; error?: string }> {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${base}/api/send-convocation`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: payload.to,
        playerName: payload.playerName,
        gameTitle: payload.gameTitle,
        gameDate: payload.gameDate,
        gameTime: payload.gameTime,
        gameLocation: payload.gameLocation,
        appUrl: payload.appUrl,
        calendarUrl: payload.calendarUrl,
        from: DEFAULT_FROM,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text || `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
