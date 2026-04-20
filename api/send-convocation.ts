import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ConvocationBody {
  to: string;
  playerName: string;
  gameTitle: string;
  gameDate: string;
  gameTime: string;
  gameLocation: string;
  appUrl: string;
  calendarUrl: string;
  from?: string;
}

function buildConvocationHtml(p: ConvocationBody): string {
  const from = p.from || 'onboarding@resend.dev';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convocatória</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 24px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          <tr>
            <td style="background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); padding: 28px 24px; text-align: center;">
              <h1 style="margin:0; color: #ffffff; font-size: 22px; font-weight: 700;">Estás convocado(a)!</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">${escapeHtml(p.gameTitle)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 28px 24px;">
              <p style="margin: 0 0 16px; color: #374151; font-size: 16px; line-height: 1.5;">Olá <strong>${escapeHtml(p.playerName)}</strong>,</p>
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 15px; line-height: 1.6;">Foste selecionado(a) para o próximo jogo. Seguem os detalhes:</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f8fafc; border-radius: 8px; margin-bottom: 24px;">
                <tr><td style="padding: 16px 20px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Data e hora</p>
                  <p style="margin: 0; color: #111827; font-size: 15px; font-weight: 600;">${escapeHtml(p.gameDate)} às ${escapeHtml(p.gameTime)}</p>
                </td></tr>
                <tr><td style="padding: 0 20px 16px;">
                  <p style="margin: 0 0 8px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Local</p>
                  <p style="margin: 0; color: #111827; font-size: 15px;">${escapeHtml(p.gameLocation || '—')}</p>
                </td></tr>
              </table>
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 14px;">Adiciona o jogo ao teu calendário para não falhares:</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 16px;">
                    <a href="${escapeHtml(p.calendarUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 600;">Adicionar ao Google Calendar</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 16px 0 0; color: #6b7280; font-size: 13px;">Confirmar presença na app: <a href="${escapeHtml(p.appUrl)}" style="color: #0d9488;">${escapeHtml(p.appUrl)}</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 24px; background: #f8fafc; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">Liga de Clubes M6</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function escapeHtml(s: string): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(
  req: { method?: string; body?: ConvocationBody },
  res: { setHeader: (k: string, v: string) => void; status: (n: number) => { json: (o: object) => void }; json: (o: object) => void }
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured' });
  }

  const body = req.body as ConvocationBody;
  const { to, playerName, gameTitle, gameDate, gameTime, gameLocation, appUrl, calendarUrl } = body || {};
  const from = (body?.from || 'onboarding@resend.dev').trim();

  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return res.status(400).json({ error: 'Invalid or missing "to" email' });
  }

  const payload: ConvocationBody = {
    to: to.trim(),
    playerName: playerName ?? 'Jogador',
    gameTitle: gameTitle ?? 'Jogo',
    gameDate: gameDate ?? '',
    gameTime: gameTime ?? '',
    gameLocation: gameLocation ?? '',
    appUrl: appUrl ?? '',
    calendarUrl: calendarUrl ?? '',
    from,
  };

  const html = buildConvocationHtml(payload);
  const subject = `Convocatória: ${payload.gameTitle} — ${payload.gameDate}`;

  const { data, error } = await resend.emails.send({
    from: `Liga M6 <${from}>`,
    to: [payload.to],
    subject,
    html,
  });

  if (error) {
    console.error('[send-convocation] Resend error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send email' });
  }

  return res.status(200).json({ ok: true, id: data?.id });
}
