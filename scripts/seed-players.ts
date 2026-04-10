/**
 * Seed: reinserir jogadores na tabela players após perda de dados.
 * Os utilizadores já devem existir no Supabase Auth; o script associa cada email ao user_id
 * e insere a ficha em players com a equipa e pontos indicados.
 *
 * REQUER: .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_*).
 * Uso: npx tsx scripts/seed-players.ts
 *
 * IMPORTANTE: Edita a lista SEED_PLAYERS abaixo e coloca os emails EXATOS que cada jogador
 * usa no Supabase Auth (Authentication → Users). Assim eles conseguem fazer login.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();
config({ path: '.env.local' });

/** ID da equipa M6 criada (usar sempre este no seed). */
const TEAM_ID = '00000000-0000-0000-0000-000000000001';

/** Jogadores a reinserir. Substitui os emails pelos emails reais do Supabase Auth. */
const SEED_PLAYERS: { name: string; email: string; federation_points: number }[] = [
  { name: 'Salvador Simões', email: 'salvador.simoes@example.com', federation_points: 20 },
  { name: 'Teresa Maria', email: 'teresa.maria@example.com', federation_points: 13 },
  { name: 'Maria Luísa', email: 'maria.luisa@example.com', federation_points: 0 },
  // Adiciona mais linhas aqui com nome, email (do Auth) e federation_points.
];

const PREFERRED_SIDE_VALUES = ['left', 'right', 'both'] as const;
type PreferredSide = (typeof PREFERRED_SIDE_VALUES)[number];
const DEFAULT_PREFERRED_SIDE: PreferredSide = 'both';

const ROLE_JOGADOR = 'jogador';

function getEnv(name: string, fallbackName?: string): string {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (!value || value.trim() === '') {
    console.error(`\n❌ Erro: A variável ${name} não está definida. Usa .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY.\n`);
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

async function findAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string
): Promise<{ id: string } | null> {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user ? { id: user.id } : null;
}

async function main(): Promise<void> {
  console.log('\n--- Seed: reinserir jogadores em players ---\n');

  const supabaseUrl = normalizeSupabaseUrl(getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL'));
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY');

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let ok = 0;
  let skip = 0;
  let notFound = 0;

  for (const row of SEED_PLAYERS) {
    const email = row.email.trim().toLowerCase();
    if (!email || email === 'example.com' || row.email.includes('@example.com')) {
      console.warn(`⚠️  Ignorado "${row.name}": substitui o email em SEED_PLAYERS pelo email real do Auth.`);
      skip++;
      continue;
    }

    const authUser = await findAuthUserByEmail(supabaseAdmin, email);
    if (!authUser) {
      console.warn(`⚠️  Auth sem utilizador com email "${email}" (${row.name}). Cria a conta no Auth ou corrige o email no script.`);
      notFound++;
      continue;
    }

    const { data: existing } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from('players')
        .update({
          team_id: TEAM_ID,
          name: row.name,
          email,
          federation_points: row.federation_points,
          is_active: true,
          role: ROLE_JOGADOR,
          preferred_side: DEFAULT_PREFERRED_SIDE,
          profile_completed: true,
        })
        .eq('id', existing.id);

      if (updateErr) {
        console.error(`❌ Erro ao atualizar ${row.name}:`, updateErr.message);
        continue;
      }
      console.log(`✅ Atualizado: ${row.name} (${row.federation_points} pts)`);
      ok++;
      continue;
    }

    const { error: insertErr } = await supabaseAdmin.from('players').insert({
      user_id: authUser.id,
      team_id: TEAM_ID,
      name: row.name,
      email,
      phone: null,
      federation_points: row.federation_points,
      is_active: true,
      role: ROLE_JOGADOR,
      preferred_side: DEFAULT_PREFERRED_SIDE,
      profile_completed: true,
    });

    if (insertErr) {
      console.error(`❌ Erro ao inserir ${row.name}:`, insertErr.message);
      continue;
    }
    console.log(`✅ Inserido: ${row.name} (${row.federation_points} pts)`);
    ok++;
  }

  console.log('\n--- Resumo ---');
  console.log('   Inseridos/atualizados:', ok);
  if (skip) console.log('   Ignorados (email placeholder):', skip);
  if (notFound) console.log('   Sem conta Auth com esse email:', notFound);
  console.log('---\n');
}

main().catch((err) => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
