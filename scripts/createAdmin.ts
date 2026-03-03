/**
 * Script seguro para criar um utilizador administrador completo (testes).
 * REQUER: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou .env / .env.local).
 * NÃO usa a anon key — apenas funciona com Service Role Key.
 *
 * Uso: npm run create-admin   ou   npx tsx scripts/createAdmin.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Carregar .env e .env.local para não depender de export no terminal
config();
config({ path: '.env.local' });

const ADMIN_EMAIL = 'admin@ligam6.pt';
const ADMIN_PASSWORD = 'Admin123!';
const ADMIN_NAME = 'Administrador Sistema';

/** Valores permitidos pela constraint players_preferred_side_check na BD */
const PREFERRED_SIDE_VALUES = ['left', 'right', 'both'] as const;
type PreferredSide = (typeof PREFERRED_SIDE_VALUES)[number];

const ADMIN_PREFERRED_SIDE: PreferredSide = 'both';

function ensureValidPreferredSide(value: unknown): PreferredSide {
  if (value !== null && value !== undefined && PREFERRED_SIDE_VALUES.includes(value as PreferredSide)) {
    return value as PreferredSide;
  }
  return ADMIN_PREFERRED_SIDE;
}

/** Remove prefixo https:// duplicado e normaliza o URL do Supabase. */
function normalizeSupabaseUrl(url: string): string {
  let u = url.trim();
  while (u.startsWith('https://')) u = u.slice(8);
  if (!u.startsWith('http://')) u = 'https://' + u;
  try {
    const parsed = new URL(u);
    if (!parsed.hostname.endsWith('.supabase.co')) {
      console.warn('⚠️  Aviso: SUPABASE_URL não parece um host Supabase (*.supabase.co).');
    }
    return parsed.origin;
  } catch {
    return 'https://' + u;
  }
}

function getEnv(name: string, fallbackName?: string): string {
  let value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (!value || value.trim() === '') {
    console.error(`\n❌ Erro: A variável de ambiente ${name} não está definida.\n`);
    console.error('   Defina no terminal ou em .env.local (nunca commitar chaves):');
    console.error('   SUPABASE_URL="https://<TEU_PROJETO>.supabase.co"');
    console.error('   SUPABASE_SERVICE_ROLE_KEY="eyJ..."');
    process.exit(1);
  }
  return value.trim();
}

function ensureServiceRoleKey(key: string): void {
  // A anon key é mais curta e começa por "eyJ" mas o conteúdo JWT é diferente.
  // Verificação simples: service role key não deve ser igual a variáveis típicas de anon.
  const anonFromEnv = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (anonFromEnv && key === anonFromEnv) {
    console.error('\n❌ Erro: Está a usar a ANON KEY em vez da SERVICE ROLE KEY.\n');
    console.error('   Use SUPABASE_SERVICE_ROLE_KEY (do dashboard Supabase → Settings → API).');
    process.exit(1);
  }
}

async function findAuthUserByEmail(supabaseAdmin: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user?.id ?? null;
}

async function main(): Promise<void> {
  console.log('\n--- Criar administrador (testes) ---\n');

  const rawUrl = getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supabaseUrl = normalizeSupabaseUrl(rawUrl);
  if (rawUrl !== supabaseUrl) {
    console.log('ℹ️  URL normalizado:', supabaseUrl);
  }

  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  ensureServiceRoleKey(serviceRoleKey);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // 1) Verificar se já existe registo em "players" com este email
  const { data: existingPlayer, error: checkError } = await supabaseAdmin
    .from('players')
    .select('id, user_id, name, email, role')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();

  if (checkError) {
    const msg = checkError.message ?? '';
    const isNetwork = /fetch failed|ECONNREFUSED|ENOTFOUND|Could not resolve host/i.test(msg);
    console.error('❌ Erro ao verificar utilizador existente:', checkError.message);
    if (isNetwork) {
      console.error('\n   Sugestões:');
      console.error('   • Verifique SUPABASE_URL (ex.: sem https:// duplicado):', supabaseUrl);
      console.error('   • Verifique ligação à internet e que o projeto Supabase existe.');
    }
    process.exit(1);
  }

  if (existingPlayer) {
    console.log('ℹ️  Utilizador administrador já existe na base de dados.\n');
    console.log('--- Credenciais ---');
    console.log('   Email:   ', ADMIN_EMAIL);
    console.log('   Password:', ADMIN_PASSWORD);
    console.log('   Player:  ', existingPlayer.name, '| role:', existingPlayer.role);
    console.log('---\n');
    process.exit(0);
  }

  let userId: string;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    const isDuplicate = /already exists|already registered|already been registered/i.test(authError.message);
    if (isDuplicate) {
      const existingUserId = await findAuthUserByEmail(supabaseAdmin, ADMIN_EMAIL);
      if (!existingUserId) {
        console.error('❌ Utilizador já existe em Auth mas não foi possível obter o id:', authError.message);
        process.exit(1);
      }
      userId = existingUserId;
      console.log('ℹ️  Utilizador já existia em Auth; a criar/atualizar perfil em "players"...');
    } else {
      console.error('❌ Erro ao criar utilizador Auth:', authError.message);
      process.exit(1);
    }
  } else if (!authData?.user?.id) {
    console.error('❌ Utilizador não foi criado (sem id).');
    process.exit(1);
  } else {
    userId = authData.user.id;
    console.log('✅ Utilizador Auth criado:', authData.user.id);
  }

  const preferredSide = ensureValidPreferredSide(ADMIN_PREFERRED_SIDE);

  const { data: playerData, error: playerError } = await supabaseAdmin
    .from('players')
    .insert({
      user_id: userId,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: '',
      federation_points: 9999,
      preferred_side: preferredSide,
      profile_completed: true,
      role: 'admin',
      is_active: true,
    })
    .select('id, user_id, name, email, role, federation_points, preferred_side, profile_completed')
    .single();

  if (playerError) {
    if (playerError.code === '23505') {
      console.log('ℹ️  Registo em "players" já existe para este user_id; a mostrar credenciais.');
      const { data: p } = await supabaseAdmin
        .from('players')
        .select('id, name, email, role')
        .eq('user_id', userId)
        .single();
      if (p) {
        console.log('\n--- Credenciais ---');
        console.log('   Email:   ', ADMIN_EMAIL);
        console.log('   Password:', ADMIN_PASSWORD);
        console.log('   Player:  ', p.name, '| role:', p.role);
        console.log('---\n');
      }
      process.exit(0);
    }
    console.error('❌ Erro ao criar registo em "players":', playerError.message);
    process.exit(1);
  }

  console.log('✅ Registo em "players" criado:', playerData?.id);

  console.log('\n--- Credenciais criadas ---');
  console.log('   Email:             ', ADMIN_EMAIL);
  console.log('   Password:         ', ADMIN_PASSWORD);
  console.log('   Nome:             ', playerData?.name ?? ADMIN_NAME);
  console.log('   Role:             ', playerData?.role ?? 'admin');
  console.log('   Federation points:', playerData?.federation_points ?? 9999);
  console.log('   Preferred side:   ', playerData?.preferred_side ?? preferredSide);
  console.log('   Profile completed:', playerData?.profile_completed ?? true);
  console.log('---\n');
}

main().catch((err) => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
