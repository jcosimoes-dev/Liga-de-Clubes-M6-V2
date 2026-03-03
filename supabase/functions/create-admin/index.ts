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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const adminEmail = 'administrador@equipam6.local';
    const adminPassword = 'admin123';

    const { data: existingPlayer, error: checkError } = await supabaseAdmin
      .from('players')
      .select('id, name, email, role')
      .eq('email', adminEmail)
      .maybeSingle();

    if (checkError) {
      console.error('[create-admin] Erro ao verificar utilizador:', checkError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar utilizador existente' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (existingPlayer) {
      console.log('[create-admin] Utilizador já existe:', existingPlayer);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Utilizador administrador já existe',
          credentials: {
            email: adminEmail,
            password: adminPassword,
          },
          player: existingPlayer,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[create-admin] Criando utilizador administrador...');

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

    if (authError) {
      console.error('[create-admin] Erro ao criar utilizador Auth:', authError);
      return new Response(
        JSON.stringify({
          error: 'Erro ao criar utilizador de autenticação',
          details: authError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Utilizador não foi criado' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[create-admin] Utilizador Auth criado:', authData.user.id);

    const { data: playerData, error: playerError } = await supabaseAdmin
      .from('players')
      .insert({
        user_id: authData.user.id,
        name: 'Administrador',
        email: adminEmail,
        phone: '',
        federation_points: 0,
        is_active: true,
        role: PlayerRoles.admin,
      })
      .select('id, user_id, name, email, role')
      .single();

    if (playerError) {
      console.error('[create-admin] Erro ao criar perfil de player:', playerError);
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

    console.log('[create-admin] SUCESSO! Administrador criado:', playerData);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Administrador criado com sucesso!',
        credentials: {
          email: adminEmail,
          password: adminPassword,
        },
        player: playerData,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[create-admin] EXCEÇÃO:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Erro ao criar administrador',
        details: err instanceof Error ? err.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
