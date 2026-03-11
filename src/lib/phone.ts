/**
 * Normaliza e formata números de telefone (Portugal +351).
 * Remove espaços, parênteses e traços; adiciona 351 se for número português de 9 dígitos.
 */

/** Extrai apenas dígitos. Remove espaços, parênteses, traços e qualquer não-dígito. */
function digitsOnly(s: string): string {
  return (s || '').replace(/\D/g, '');
}

/**
 * Formata número para o link wa.me (uso global).
 * - Remove todos os espaços, parênteses e traços (replace(/\D/g, '')).
 * - Se o número começar por '9' e tiver 9 dígitos, adiciona '351' no início.
 * - Se já começar por '351', mantém (até 12 dígitos).
 * - Retorna string vazia se vazio ou inválido (fallback: link abre seletor geral do WhatsApp).
 */
export function formatWhatsAppNumber(phone: string | null | undefined): string {
  if (phone == null || typeof phone !== 'string') return '';
  const d = digitsOnly(phone);
  if (d.length === 0) return '';
  if (d.startsWith('351') && d.length >= 12) return d.slice(0, 12);
  if (d.length === 9 && d[0] === '9') return '351' + d;
  if (d.length === 9 && ['2', '3'].includes(d[0])) return '351' + d;
  return '';
}

/**
 * Normaliza o número para guardar na BD: sem espaços/traços, com prefixo +351 se for PT.
 * Ex.: "91 234 5678" → "+351912345678"
 */
export function normalizePhoneForDb(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const d = digitsOnly(raw);
  if (d.length === 0) return null;
  if (d.length === 9 && ['9', '2', '3'].includes(d[0])) return `+351${d}`;
  if (d.startsWith('0') && d.length === 10) return `+351${d.slice(1)}`;
  if (d.startsWith('351') && d.length >= 12) return `+${d.slice(0, 12)}`;
  return d.startsWith('+') ? raw.trim() : `+${d}`;
}

/**
 * Formata para o link wa.me: apenas dígitos, com 351 para números PT.
 * Ex.: "+351 912 345 678" → "351912345678"
 * Preferir formatWhatsAppNumber para nova lógica unificada.
 */
export function formatPhoneForWhatsApp(phone: string | null | undefined): string {
  return formatWhatsAppNumber(phone) || (() => {
    if (!phone || typeof phone !== 'string') return '';
    const d = digitsOnly(phone);
    if (d.startsWith('0') && d.length === 10) return '351' + d.slice(1);
    return d;
  })();
}
