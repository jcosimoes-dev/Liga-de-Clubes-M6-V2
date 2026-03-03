import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const DEFAULT_PASSWORD = 'Mudar123!';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    console.log('1. Criando cliente com token do usuário');
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    console.log('2. Obtendo usuário autenticado');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Erro ao obter usuário:', userError);
      throw new Error('Não autorizado');
    }
    console.log('3. Usuário autenticado:', user.id);

    console.log('4. Criando cliente admin');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    console.log('5. Verificando se usuário é admin');
    const { data: adminPlayer, error: adminError } = await supabaseAdmin
      .from('players')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError) {
      console.error('Erro ao verificar admin:', adminError);
      throw new Error('Erro ao verificar permissões: ' + adminError.message);
    }

    console.log('6. Admin player:', adminPlayer);

    if (!adminPlayer || adminPlayer.role !== 'admin') {
      throw new Error('Apenas administradores podem redefinir passwords');
    }

    console.log('7. Parseando body da requisição');
    const { playerId } = await req.json();
    if (!playerId) {
      throw new Error('Player ID é obrigatório');
    }
    console.log('8. Player ID:', playerId);

    console.log('8. Buscando jogador alvo');
    const { data: targetPlayer, error: playerError } = await supabaseAdmin
      .from('players')
      .select('user_id, name')
      .eq('id', playerId)
      .maybeSingle();

    if (playerError) {
      console.error('Erro ao buscar jogador:', playerError);
      throw new Error('Erro ao buscar jogador: ' + playerError.message);
    }

    console.log('9. Jogador encontrado:', targetPlayer);

    if (!targetPlayer || !targetPlayer.user_id) {
      throw new Error('Jogador não encontrado');
    }

    console.log('10. Atualizando password no Auth para password padrão');
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetPlayer.user_id,
      { password: DEFAULT_PASSWORD }
    );

    if (updateError) {
      console.error('Erro ao atualizar password:', updateError);
      throw new Error('Erro ao atualizar password: ' + updateError.message);
    }

    console.log('11. Password atualizada com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        password: DEFAULT_PASSWORD,
        playerName: targetPlayer.name,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Erro ao redefinir password:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao redefinir password',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
