import { createClient } from 'npm:@supabase/supabase-js@2';
import { PlayerRoles } from '../_shared/constants.ts';

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
      console.error('[bootstrap-admin] Erro de autenticação:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[bootstrap-admin] User autenticado:', user.id, user.email);

    const { data: existingAdmins, error: adminCheckError } = await supabaseClient
      .from('players')
      .select('id, name, role')
      .eq('role', PlayerRoles.admin)
      .limit(1);

    if (adminCheckError) {
      console.error('[bootstrap-admin] Erro ao verificar admins:', adminCheckError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar administradores existentes' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.log('[bootstrap-admin] Já existe admin:', existingAdmins[0]);
      return new Response(
        JSON.stringify({ error: 'Já existe um administrador. Bootstrap não permitido.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[bootstrap-admin] Nenhum admin encontrado. Prosseguindo com bootstrap...');

    const { data: currentPlayer, error: playerError } = await supabaseClient
      .from('players')
      .select('id, user_id, name, email, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (playerError) {
      console.error('[bootstrap-admin] Erro ao buscar player:', playerError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar perfil de jogador' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!currentPlayer) {
      console.log('[bootstrap-admin] Player não encontrado. Utilizador deve completar perfil primeiro.');
      return new Response(
        JSON.stringify({
          error: 'Complete o seu perfil primeiro em /complete-profile e volte a tentar.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const playerToPromote = currentPlayer;

    console.log('[bootstrap-admin] Promovendo player a admin:', playerToPromote?.id);

    const { data: updatedPlayer, error: updateError } = await supabaseClient
      .from('players')
      .update({ role: PlayerRoles.admin })
      .eq('id', playerToPromote.id)
      .select('id, user_id, name, email, role')
      .single();

    if (updateError) {
      console.error('[bootstrap-admin] Erro ao promover para admin:', updateError);
      return new Response(
        JSON.stringify({
          error: 'Erro ao promover para administrador',
          details: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[bootstrap-admin] SUCESSO! Player promovido:', updatedPlayer);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${updatedPlayer.name} foi promovido a Administrador!`,
        player: updatedPlayer,
        created: !currentPlayer,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[bootstrap-admin] EXCEÇÃO:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Erro ao processar bootstrap',
        details: err instanceof Error ? err.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
