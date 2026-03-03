/**
 * Extrai mensagem amigável de erros do Supabase Auth (signUp, signIn).
 * Usa error.code para identificação robusta (não string matching em mensagens).
 */

export const MIN_PASSWORD_LENGTH = 8;
export const PASSWORD_REQUIREMENTS =
  'Mínimo 8 caracteres, incluindo maiúsculas, minúsculas e números. Evita palavras comuns.';

/** Códigos que indicam email já registado — permite fallback para signIn. */
export const EMAIL_ALREADY_EXISTS_CODES = [
  'user_already_exists',
  'email_exists',
  'email_conflict_identity_not_deletable',
];

function hasCode(err: unknown, codes: string[]): boolean {
  const code = (err as { code?: string })?.code;
  return typeof code === 'string' && codes.includes(code);
}

export function isEmailAlreadyRegistered(err: unknown): boolean {
  return hasCode(err, EMAIL_ALREADY_EXISTS_CODES);
}

export function getAuthErrorMessage(err: unknown): string {
  if (!err) return 'Erro inesperado. Tenta novamente.';
  const code = (err as { code?: string })?.code;
  const msg = (err as { message?: string })?.message ?? '';

  // Email já existe
  if (isEmailAlreadyRegistered(err)) {
    return 'Este email já está registado. Use "Repor palavra-passe" no Admin ou utilize a palavra-passe correta.';
  }

  // Password fraca
  if (code === 'weak_password') {
    return `Palavra-passe demasiado fraca. ${PASSWORD_REQUIREMENTS}`;
  }

  // Validação falhou
  if (code === 'validation_failed') {
    return msg || 'Dados inválidos. Verifica o email e a palavra-passe.';
  }

  // Registo desativado
  if (code === 'signup_disabled' || code === 'email_provider_disabled') {
    return 'O registo está desativado. Contacta o administrador.';
  }

  // Email não autorizado (SMTP default)
  if (code === 'email_address_not_authorized') {
    return 'Este endereço de email não está autorizado. O projeto só permite emails da organização Supabase.';
  }

  // Utilizar a mensagem do servidor se for útil
  if (typeof msg === 'string' && msg.length > 0 && !msg.includes('Failed to fetch')) {
    return msg;
  }

  // Fallback genérico
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  return 'Erro ao criar conta. Tenta novamente.';
}
