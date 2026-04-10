/**
 * Lista todas as linhas da tabela public.teams (id, nome, …) na base ligada em .env.local.
 *
 * Uso: npx tsx scripts/list-teams.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();
config({ path: '.env.local' });

function logErrorChain(e: unknown, label: string) {
  console.error(label, e);
  let x: unknown = e;
  let depth = 0;
  while (x && depth < 8) {
    if (x instanceof Error && x.cause != null) {
      console.error(`  cause[${depth}]:`, x.cause);
      x = x.cause;
      depth += 1;
    } else break;
  }
}

const supabaseUrl = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').trim();
const serviceRoleKey = (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const anonKey = (process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? '').trim();

async function main() {
  const key = serviceRoleKey || anonKey;
  if (!supabaseUrl || !key) {
    console.error('❌ Define VITE_SUPABASE_URL e (VITE_SUPABASE_SERVICE_ROLE_KEY ou VITE_SUPABASE_ANON_KEY) em .env.local');
    process.exit(1);
  }
  if (!serviceRoleKey) {
    console.warn('⚠️  Sem service role: se a lista vier vazia, adiciona VITE_SUPABASE_SERVICE_ROLE_KEY.\n');
  }

  const db = createClient(supabaseUrl, key, { auth: { persistSession: false } });

  let data: unknown;
  let error: { message: string } | null;
  try {
    const res = await db
      .from('teams')
      .select('id, name, description, is_active, created_at')
      .order('name', { ascending: true });
    data = res.data;
    error = res.error;
  } catch (e) {
    logErrorChain(e, 'Erro de rede / cliente ao consultar teams:');
    process.exit(1);
  }

  if (error) {
    console.error('Erro Supabase (REST):', error.message);
    logErrorChain(error, 'Detalhe:');
    process.exit(1);
  }

  const rows = data ?? [];
  console.log('\n--- Tabela teams (base ativa) ---\n');
  console.log(`Total: ${rows.length}\n`);
  for (const r of rows) {
    const name = (r as { name?: string }).name ?? '—';
    const id = (r as { id?: string }).id ?? '—';
    const active = (r as { is_active?: boolean }).is_active;
    console.log(`${name}`);
    console.log(`  id:         ${id}`);
    console.log(`  is_active:  ${active ?? '—'}`);
    console.log('');
  }
}

main().catch((e) => {
  logErrorChain(e, 'Erro não tratado:');
  process.exit(1);
});
