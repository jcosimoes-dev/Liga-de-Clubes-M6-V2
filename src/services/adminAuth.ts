import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase com SERVICE_ROLE_KEY para operações admin (ex: atualizar password de utilizadores).
 *
 * AVISO: Este ficheiro usa a chave mestra no frontend. Em produção, deves fazer esta operação
 * num backend (Edge Function ou API) para não expor a chave. Para ferramentas internas ou
 * protótipos, define VITE_SUPABASE_SERVICE_ROLE_KEY no .env.local (nunca faças commit desta chave).
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string | undefined;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Falta VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY. Adiciona no .env.local (a service role key só deve ser usada em contexto seguro).'
    );
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * Atualiza a password de um utilizador no Supabase Auth (requer service role).
 * Atualiza a tabela players definindo must_change_password = true para esse utilizador.
 * @param userId - UUID do utilizador em auth.users (ex: players.user_id)
 * @param newPassword - Nova password em texto plano
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const admin = getAdminClient();
  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (authError) throw authError;

  const { error: dbError } = await admin
    .from('players')
    .update({ must_change_password: true })
    .eq('user_id', userId);
  if (dbError) throw dbError;
}

/**
 * Atualiza apenas federation_points de um jogador (ignora RLS; usa SERVICE_ROLE).
 */
export async function updatePlayerFederationPoints(playerId: string, valor: number): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('players')
    .update({ federation_points: valor })
    .eq('id', playerId)
    .select()
    .single();
  if (error) throw error;
}

const ALLOWED_PROFILE_UPDATE_KEYS = [
  'name',
  'phone',
  'preferred_side',
  'role',
  'federation_points',
  'is_active',
  'must_change_password',
] as const;

/**
 * Atualiza perfil de um jogador usando SERVICE_ROLE (ignora RLS).
 * Útil quando o Admin edita o perfil de outro jogador e a RLS bloqueia.
 * Apenas colunas permitidas; nunca id, user_id, email, created_at.
 */
export async function updatePlayerProfileAdmin(
  playerId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const payload: Record<string, unknown> = {};
  const allowed = new Set<string>(ALLOWED_PROFILE_UPDATE_KEYS);
  for (const [key, value] of Object.entries(updates)) {
    if (allowed.has(key) && value !== undefined) payload[key] = value;
  }
  if (Object.keys(payload).length === 0) return;
  const admin = getAdminClient();
  const { error } = await admin
    .from('players')
    .update(payload)
    .eq('id', playerId)
    .select()
    .single();
  if (error) throw error;
}
