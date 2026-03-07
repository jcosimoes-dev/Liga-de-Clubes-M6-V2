/**
 * Seed: reinserir 3 jogos finalizados com duplas e resultados.
 * Usa os jogadores atuais da equipa (team_id fixo). Executa com SERVICE_ROLE.
 *
 * REQUER: .env.local com VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY.
 * Uso: npm run seed-games-results
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();
config({ path: '.env.local' });

const TEAM_ID = '75782791-729c-4863-95c5-927690656a81';

/** Status 'final' existe na BD (Row); Insert pode não listar — usamos cast. */
const GAME_STATUS_FINAL = 'final' as const;

const GAMES_TO_INSERT: {
  opponent: string;
  location: string;
  phase: 'Qualificação' | 'Regionais' | 'Nacionais' | 'Torneio' | 'Mix' | 'Treino';
  round_number: number;
  /** Dias atrás (0 = hoje, 1 = ontem) */
  daysAgo: number;
}[] = [
  { opponent: 'Os Totós da Raquete', location: 'Pavilhão Municipal', phase: 'Qualificação', round_number: 1, daysAgo: 1 },
  { opponent: 'Clube Padel X', location: 'Casa', phase: 'Regionais', round_number: 2, daysAgo: 2 },
  { opponent: 'Dream Team', location: 'Pavilhão', phase: 'Qualificação', round_number: 3, daysAgo: 3 },
];

/** Nomes exatos para as duplas (Salvador Simões, Teresa Maria, Vasco, Tiago Neves). */
const DUPLA_PLAYER_NAMES = ['Salvador Simões', 'Teresa Maria', 'Vasco', 'Tiago Neves'] as const;

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

function toStartsAt(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

async function main(): Promise<void> {
  console.log('\n--- Seed: jogos, duplas e resultados ---\n');

  const supabaseUrl = normalizeSupabaseUrl(getEnv('SUPABASE_URL', 'VITE_SUPABASE_URL'));
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY');

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: allPlayers, error: playersError } = await admin
    .from('players')
    .select('id, name')
    .eq('team_id', TEAM_ID)
    .eq('is_active', true);

  if (playersError) {
    console.error('❌ Erro ao carregar jogadores:', playersError.message);
    process.exit(1);
  }

  const byName = (name: string) => (p: { name: string | null }) =>
    (p.name ?? '').trim().toLowerCase() === name.trim().toLowerCase();
  const byNameIncludes = (part: string) => (p: { name: string | null }) =>
    (p.name ?? '').toLowerCase().includes(part.trim().toLowerCase());

  const list = allPlayers ?? [];
  const salvador = list.find(byName('Salvador Simões'))?.id;
  const teresa = list.find(byName('Teresa Maria'))?.id;
  const vasco = list.find((p) => byName('Vasco')(p) || byNameIncludes('Vasco')(p))?.id;
  const tiago = list.find((p) => byName('Tiago Neves')(p) || byNameIncludes('Tiago Neves')(p))?.id;

  const playerIds = [salvador, teresa, vasco, tiago].filter(Boolean) as string[];
  const missing = DUPLA_PLAYER_NAMES.filter((_, i) => !playerIds[i]);
  if (playerIds.length < 4) {
    console.error(`❌ Faltam jogadores para as duplas: ${missing.join(', ')}. Encontrados na equipa: ${list.map((p) => p.name).join(', ')}`);
    process.exit(1);
  }

  const createdBy = playerIds[0];
  const [p1, p2, p3, p4] = playerIds;

  for (const g of GAMES_TO_INSERT) {
    const startsAt = toStartsAt(g.daysAgo);

    const { data: gameRow, error: gameErr } = await admin
      .from('games')
      .insert({
        round_number: g.round_number,
        starts_at: startsAt,
        opponent: g.opponent,
        location: g.location,
        phase: g.phase,
        status: GAME_STATUS_FINAL,
        team_id: TEAM_ID,
        team_points: null,
        no_show: false,
        created_by: createdBy,
      } as Record<string, unknown>)
      .select('id')
      .single();

    if (gameErr) {
      console.error(`❌ Erro ao inserir jogo "${g.opponent}":`, gameErr.message);
      continue;
    }
    const gameId = gameRow!.id;
    console.log(`✅ Jogo: ${g.opponent} (${gameId})`);

    const pairsToInsert: { game_id: string; player1_id: string; player2_id: string; pair_order: number; total_points: number }[] = [
      { game_id: gameId, player1_id: p1, player2_id: p2, pair_order: 1, total_points: 0 },
      { game_id: gameId, player1_id: p3, player2_id: p4, pair_order: 2, total_points: 0 },
    ];

    for (const pairRow of pairsToInsert) {
      const { data: pairData, error: pairErr } = await admin
        .from('pairs')
        .insert(pairRow)
        .select('id')
        .single();

      if (pairErr) {
        console.error('❌ Erro ao inserir dupla:', pairErr.message);
        continue;
      }
      const pairId = pairData!.id;

      const { error: resErr } = await admin.from('results').insert({
        game_id: gameId,
        pair_id: pairId,
        created_by: createdBy,
        set1_casa: 6,
        set1_fora: 4,
        set2_casa: 6,
        set2_fora: 3,
      });

      if (resErr) {
        console.error('❌ Erro ao inserir resultado:', resErr.message);
        continue;
      }
    }

    for (const playerId of [p1, p2, p3, p4]) {
      const { error: convErr } = await admin.from('convocations').insert({ game_id: gameId, player_id: playerId });
      if (convErr) console.warn('   Aviso convocations:', convErr.message);
    }
    console.log('   Duplas, resultados e 4 registos em convocations inseridos.');
  }

  console.log('\n--- Concluído. O Histórico deve mostrar os 3 jogos. ---\n');
}

main().catch((err) => {
  console.error('❌ Erro inesperado:', err);
  process.exit(1);
});
