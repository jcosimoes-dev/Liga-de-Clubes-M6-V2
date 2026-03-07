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
 * federation_points é EXCLUSIVAMENTE manual (perfil). Nunca sobrescrito pelo recálculo.
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

/**
 * Atualiza apenas liga_points de um jogador (ignora RLS; usa SERVICE_ROLE).
 * Usado pelo botão "Recalcular Pontos" — pontos da liga M6 (10v/3d). federation_points não é tocado.
 */
export async function updatePlayerLigaPoints(playerId: string, valor: number): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('players')
    .update({ liga_points: valor })
    .eq('id', playerId)
    .select()
    .single();
  if (error) throw error;
}

/**
 * Atualiza o status de um jogo usando SERVICE_ROLE (ignora RLS).
 * Usado no fecho da convocatória para garantir que o Coordenador consegue persistir.
 * @param gameId - UUID do jogo
 * @param status - 'convocatoria_fechada' | 'final' | outro valor válido
 */
export async function closeGameStatusAdmin(
  gameId: string,
  status: string,
  extra?: Record<string, unknown>
): Promise<void> {
  const admin = getAdminClient();
  const payload = { status, ...extra };
  console.log('[adminAuth] A fechar jogo ID:', gameId, 'status:', status, extra ? 'extra:' : '', extra);
  const { error } = await admin.from('games').update(payload).eq('id', gameId);
  if (error) throw error;
}

/**
 * Upsert resultado na tabela results usando SERVICE_ROLE (ignora RLS).
 * Usado pelo Coordenador para gravar resultados finais sem bloqueio RLS (42501).
 */
export async function upsertResultAdmin(payload: {
  game_id: string;
  pair_id: string;
  created_by: string;
  set1_casa: number;
  set1_fora: number;
  set2_casa: number;
  set2_fora: number;
  set3_casa?: number | null;
  set3_fora?: number | null;
}): Promise<void> {
  const admin = getAdminClient();
  const row: Record<string, unknown> = {
    game_id: payload.game_id,
    pair_id: payload.pair_id,
    created_by: payload.created_by,
    set1_casa: payload.set1_casa,
    set1_fora: payload.set1_fora,
    set2_casa: payload.set2_casa,
    set2_fora: payload.set2_fora,
  };
  if (payload.set3_casa != null && payload.set3_fora != null) {
    row.set3_casa = payload.set3_casa;
    row.set3_fora = payload.set3_fora;
  }
  console.log('[adminAuth] upsertResultAdmin game_id:', payload.game_id, 'pair_id:', payload.pair_id);
  const { error } = await admin
    .from('results')
    .upsert(row, { onConflict: 'game_id,pair_id' });
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
