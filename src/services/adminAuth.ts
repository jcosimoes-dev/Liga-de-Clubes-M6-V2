import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase com SERVICE_ROLE_KEY para operações admin (ex: atualizar password de utilizadores).
 *
 * AVISO: Este ficheiro usa a chave mestra no frontend. Em produção, deves fazer esta operação
 * num backend (Edge Function ou API) para não expor a chave. Para ferramentas internas ou
 * protótipos, define VITE_SUPABASE_SERVICE_ROLE_KEY no .env.local (nunca faças commit desta chave).
 */
function readAdminEnv(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_SERVICE_ROLE_KEY'): string | undefined {
  try {
    const im = import.meta as unknown as { env?: Record<string, string | undefined> };
    const v = im.env?.[key];
    if (typeof v === 'string' && v.trim() !== '') return v;
  } catch {
    /* empty */
  }
  if (typeof process !== 'undefined' && process.env) {
    if (key === 'VITE_SUPABASE_URL') {
      return process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim() || undefined;
    }
    return (
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined
    );
  }
  return undefined;
}

const supabaseUrl = readAdminEnv('VITE_SUPABASE_URL');
const serviceRoleKey = readAdminEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Falta VITE_SUPABASE_URL ou VITE_SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_*). Adiciona no .env.local (a service role key só deve ser usada em contexto seguro).'
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
    .maybeSingle();
  if (error) throw error;
}

/**
 * Atualiza apenas liga_points de um jogador (ignora RLS; usa SERVICE_ROLE).
 * Usado pelo botão "Recalcular Pontos" — pontos da liga M6 (regras de eliminatória em `ligaPointsEliminatoria`). federation_points não é tocado.
 */
export async function updatePlayerLigaPoints(playerId: string, valor: number): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin
    .from('players')
    .update({ liga_points: valor })
    .eq('id', playerId)
    .select()
    .maybeSingle();
  if (error) throw error;
}

/**
 * Atualiza o status de um jogo usando SERVICE_ROLE (ignora RLS).
 * Usado no fecho da convocatória para garantir que o Coordenador consegue persistir.
 * @param gameId - UUID do jogo
 * @param status - 'convocatoria_fechada' | 'concluido' | 'final' | outro valor válido
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
 * Atualiza campos editáveis do jogo com SERVICE_ROLE (ignora RLS).
 * Usado quando o cliente autenticado devolve 0 linhas no SELECT após UPDATE ou falha de permissão.
 */
export async function updateGameDetailsAdmin(
  gameId: string,
  updates: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const admin = getAdminClient();
  const cols = 'id, status, opponent, starts_at, end_date, location, phase, round_number';
  const colsGameDate = 'id, status, opponent, game_date, end_date, location, phase, round_number';

  const run = (payload: Record<string, unknown>, selectCols: string) =>
    admin.from('games').update(payload).eq('id', gameId).select(selectCols).maybeSingle();

  let res = await run(updates, cols);
  if (res.error) {
    const msg = res.error.message?.toLowerCase() ?? '';
    const code = (res.error as { code?: string }).code;
    const tryLegacy =
      updates.starts_at != null &&
      (code === 'PGRST204' ||
        code === '42703' ||
        /column|schema|undefined column|could not find|starts_at|game_date/i.test(msg));
    if (tryLegacy) {
      const legacy: Record<string, unknown> = { ...updates };
      legacy.game_date = legacy.starts_at;
      delete legacy.starts_at;
      res = await run(legacy, colsGameDate);
    }
  }
  if (res.error) throw res.error;
  const row = res.data as Record<string, unknown> | null;
  if (!row) return null;
  const dateVal = row.starts_at ?? row.game_date;
  return { ...row, starts_at: dateVal ?? '', end_date: row.end_date ?? null };
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
    .maybeSingle();
  if (error) throw error;
}
