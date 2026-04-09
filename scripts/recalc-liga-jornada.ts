/**
 * Recalcula `liga_points` com as regras de eliminatória para uma jornada (`round_number`).
 * Por omissão: jornada 1. Usa SERVICE ROLE (ignora RLS).
 *
 * Não altera `federation_points`. O total no perfil = liga_points + federation_points.
 *
 * Variáveis (.env.local ou .env):
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE_KEY
 * Opcionais:
 *   TEAM_ID — só esta equipa (UUID)
 *   LIGA_ROUND — número da jornada (default: 1)
 *
 * Uso: npm run recalc-liga-jornada
 */

import { config } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });
config({ path: resolve(__dirname, '../.env') });

function getEnv(name: string, fallback?: string): string {
  const v = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!v || v.trim() === '') {
    console.error(`\n❌ Falta ${name}${fallback ? ` (ou ${fallback})` : ''} no .env.local\n`);
    process.exit(1);
  }
  return v.trim();
}

const url = getEnv('VITE_SUPABASE_URL', 'SUPABASE_URL');
const serviceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY');

const teamIdFilter = process.env.TEAM_ID?.trim() || undefined;
const roundNumber = Number.parseInt(process.env.LIGA_ROUND ?? '1', 10);
if (!Number.isFinite(roundNumber)) {
  console.error('LIGA_ROUND inválido');
  process.exit(1);
}

const { syncPlayerPointsWithClient } = await import('../src/services/points.service.ts');

const admin: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } });

console.log('\n📊 Recálculo Liga — jornada', roundNumber, teamIdFilter ? `(equipa ${teamIdFilter})` : '(todas as equipas com jogos nesta jornada)');

const { updated, errors } = await syncPlayerPointsWithClient(admin, teamIdFilter, { roundNumber });

const needsNumericMigration = errors.some((e) => /integer.*3\.|type integer/i.test(e) || e.includes('invalid input syntax for type integer'));
if (needsNumericMigration) {
  console.error(`
❌ A coluna players.liga_points ainda é integer na base de dados.
   Os pontos da nova tabela usam decimais (ex.: 3.13, 9.38).

   Corre no Supabase → SQL Editor o ficheiro:
   scripts/sql/alter_players_liga_points_numeric.sql

   (ou aplica a migração 20260407190000_liga_points_numeric.sql)
`);
}

if (errors.length && !needsNumericMigration) {
  console.error('Erros:', errors);
}
console.log(`\n✅ Linhas de jogador atualizadas (liga_points): ${updated}\n`);

/** Equipas envolvidas no recálculo (para listar totais) */
let teamIds: string[] = [];
if (teamIdFilter) {
  teamIds = [teamIdFilter];
} else {
  const { data: games, error: gErr } = await admin
    .from('games')
    .select('team_id')
    .eq('round_number', roundNumber)
    .in('status', ['final', 'concluido', 'completed']);
  if (!gErr && games?.length) {
    teamIds = [...new Set(games.map((g: { team_id: string }) => g.team_id).filter(Boolean))];
  }
}

for (const tid of teamIds) {
  const { data: players, error: pErr } = await admin
    .from('players')
    .select('id, name, liga_points, federation_points')
    .eq('team_id', tid)
    .order('name');
  if (pErr) {
    console.error('Erro ao listar jogadores:', pErr.message);
    continue;
  }
  console.log(`— Equipa ${tid} —`);
  console.log(
    ['Jogador', 'Liga', 'FPP', 'Total'].map((h) => h.padEnd(22)).join(''),
  );
  for (const row of players ?? []) {
    const r = row as { name?: string; liga_points?: number | string; federation_points?: number | string };
    const liga = Number(r.liga_points ?? 0) || 0;
    const fed = Number(r.federation_points ?? 0) || 0;
    const total = Math.round((liga + fed) * 100) / 100;
    const name = (r.name ?? '—').slice(0, 20);
    console.log([name.padEnd(22), String(liga).padEnd(22), String(fed).padEnd(22), String(total)].join(''));
  }
  console.log('');
}

process.exit(errors.length ? 1 : 0);
