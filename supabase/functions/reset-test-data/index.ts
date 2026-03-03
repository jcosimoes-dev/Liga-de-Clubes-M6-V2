import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: player, error: playerError } = await supabaseClient
      .from('players')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (playerError || !player || player.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const deletionResults = {
      results: 0,
      pairs: 0,
      availabilities: 0,
      games: 0,
    };

    const { data: deletedResults, error: resultsError } = await supabaseClient
      .from('results')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (resultsError) {
      throw new Error(`Erro ao apagar resultados: ${resultsError.message}`);
    }
    deletionResults.results = deletedResults?.length || 0;

    const { data: deletedPairs, error: pairsError } = await supabaseClient
      .from('pairs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (pairsError) {
      throw new Error(`Erro ao apagar duplas: ${pairsError.message}`);
    }
    deletionResults.pairs = deletedPairs?.length || 0;

    const { data: deletedAvailabilities, error: availabilitiesError } = await supabaseClient
      .from('availabilities')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (availabilitiesError) {
      throw new Error(`Erro ao apagar disponibilidades: ${availabilitiesError.message}`);
    }
    deletionResults.availabilities = deletedAvailabilities?.length || 0;

    const { data: deletedGames, error: gamesError } = await supabaseClient
      .from('games')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (gamesError) {
      throw new Error(`Erro ao apagar jogos: ${gamesError.message}`);
    }
    deletionResults.games = deletedGames?.length || 0;

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dados de teste apagados com sucesso',
        deleted: deletionResults,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Erro ao apagar dados de teste',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
