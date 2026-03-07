/**
 * Sincroniza a tabela players com auth.users: para cada utilizador no Auth que ainda
 * não tenha linha em players, cria uma nova linha. Usa user.id (Auth) para o campo user_id (players).
 * Usa o cliente com SERVICE_ROLE para evitar RLS.
 *
 * REQUER: .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_*).
 * Uso: npm run sync-players-from-auth
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();
config({ path: '.env.local' });

const TEAM_ID = '75782791-729c-4863-95c5-927690656a81';
const FEDERATION_POINTS_BASE = 0;
const PREFERRED_SIDE = 'both';
const ROLE_JOGADOR = 'jogador';

/** Objeto mínimo do Auth (User tem .id, não .user_id). */
interface AuthUserLike {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

/** Linha devolvida por select('user_id') em players. */
interface PlayerUserIdRow {
  user_id: string;
}

function getEnv(name: string, fallbackName?: string): string {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (!value || value.trim() === '') {
    console.error(`\n❌ Erro: A variável ${name} não está definida. Usa .env.local.\n`);
    process.exit(1);
  }
  return value.trim();
}

function normalizeSupabaseUrl(url: string): string {
  let u = url.trim();
  while (u.startsWith('https://')) u = u.slice(8);
  if (!u.startsWith('http://')) u = 'https://' + u;
  return u;
}

function getNameFromAuthUser(user: AuthUserLike): string {
  const meta = user.user_metadata;
  if (meta && typeof meta === 'object') {
    const name = (meta.full_name ?? meta.name ?? meta.display_name) as string | undefined;
    if (typeof name === 'string' && name.trim()) return name.trim();
  }
  if (user.email) {
    const part = user.email.split('@')[0];
    if (part) return part.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return 'Utilizador';
}

async function main(): Promise<void> {
  console.log('\n--- Sincronizar players com auth.users ---\n');

  const supabaseUrl = normalizeSupabaseUrl(getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL'));
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY');

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let created = 0;
  let skipped = 0;
  let page = 1;
  const perPage = 500;

  while (true) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage });
    const users: AuthUserLike[] = (data?.users ?? []) as AuthUserLike[];
    if (users.length === 0) break;

    const userIds: string[] = users.map((u) => u.id).filter(Boolean);
    const { data: existingPlayers } =
      userIds.length > 0
        ? await admin.from('players').select('user_id').in('user_id', userIds)
        : { data: [] };
    const existingSet = new Set(
      ((existingPlayers ?? []) as PlayerUserIdRow[]).map((p) => p.user_id)
    );

    for (const user of users) {
      const authId = user.id;
      if (!authId) continue;
      if (existingSet.has(authId)) {
        skipped++;
        continue;
      }
      const email = (user.email ?? '').trim().toLowerCase();
      if (!email) {
        console.warn(`⚠️  Auth user ${authId} sem email; ignorado.`);
        continue;
      }
      const name = getNameFromAuthUser(user);

      const { error } = await admin.from('players').insert({
        user_id: authId,
        team_id: TEAM_ID,
        name,
        email,
        phone: null,
        federation_points: FEDERATION_POINTS_BASE,
        is_active: true,
        role: ROLE_JOGADOR,
        preferred_side: PREFERRED_SIDE,
        profile_completed: true,
      });

      if (error) {
        console.error(`❌ Erro ao inserir ${email}:`, error.message);
        continue;
      }
      console.log(`✅ Inserido: ${name} (${email})`);
      created++;
    }

    if (users.length < perPage) break;
    page++;
  }

  console.log('\n--- Resumo ---');
  console.log('   Novos jogadores criados em players:', created);
  console.log('   Já existiam em players:', skipped);
  console.log('---\n');
}

main().catch((err) => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
