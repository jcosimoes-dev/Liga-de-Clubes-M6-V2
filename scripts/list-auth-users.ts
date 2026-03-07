/**
 * Lista utilizadores do Supabase Auth (email e id) para copiares os emails
 * para o script seed-players.ts.
 *
 * Uso: npx tsx scripts/list-auth-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();
config({ path: '.env.local' });

const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
const serviceRoleKey = (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Define VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY em .env.local');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function main() {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const users = data?.users ?? [];
  console.log('\n--- Utilizadores no Supabase Auth ---\n');
  if (users.length === 0) {
    console.log('Nenhum utilizador encontrado.\n');
    return;
  }
  for (const u of users) {
    console.log(`${u.email ?? '(sem email)'}\t${u.id}`);
  }
  console.log('\nCopia os emails acima para SEED_PLAYERS em scripts/seed-players.ts\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
