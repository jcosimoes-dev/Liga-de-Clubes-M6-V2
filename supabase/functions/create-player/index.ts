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
    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!bearerToken) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado — token em falta. Envia o header Authorization: Bearer <token>.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: {
          headers: { Authorization: `Bearer ${bearerToken}` },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado — sessão inválida ou expirada. Faz login novamente.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: currentPlayer } = await supabaseAdmin
      .from('players')
      .select('role, team_id, is_active')
      .eq('user_id', user.id)
      .single();

    if (!currentPlayer) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado — não tens perfil de jogador. Completa o perfil primeiro.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    if (currentPlayer.role !== PlayerRoles.admin || !currentPlayer.is_active) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado — só administradores ativos podem adicionar jogadores.' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body = await req.json();
    const { name, email, password, preferred_side: preferredSideRaw } = body;

    const allowed = new Set(['left', 'right', 'both']);
    const preferredSide = allowed.has(preferredSideRaw) ? preferredSideRaw : 'both';

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Nome, email e password são obrigatórios' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existingPlayer } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingPlayer) {
      return new Response(
        JSON.stringify({ error: 'Já existe um jogador com este email' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({
          error: 'Erro ao criar utilizador',
          details: authError?.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Colunas alinhadas com a tabela players: user_id, name, email, phone, federation_points, is_active, role, team_id, profile_completed, preferred_side (left|right|both)
    const { data: playerData, error: playerError } = await supabaseAdmin
      .from('players')
      .insert({
        user_id: authData.user.id,
        name,
        email,
        phone: '',
        federation_points: 0,
        is_active: true,
        role: PlayerRoles.player,
        team_id: currentPlayer.team_id,
        profile_completed: false,
        preferred_side: preferredSide,
      })
      .select()
      .single();

    if (playerError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return new Response(
        JSON.stringify({
          error: 'Erro ao criar perfil de jogador',
          details: playerError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Jogador criado com sucesso',
        player: playerData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Erro ao criar jogador',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
