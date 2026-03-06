import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ALPHANUM = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Gera uma password aleatória de 8 caracteres (letras e números). */
function generateRandomPassword(length = 8): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return out;
}

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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Não autorizado');
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      throw new Error('Não autorizado');
    }

    console.log('1. Criando cliente com token do usuário');
    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    console.log('2. Obtendo usuário autenticado');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    if (userError || !user) {
      console.error('Erro ao obter usuário:', userError);
      throw new Error('Não autorizado');
    }
    console.log('3. Usuário autenticado:', user.id);

    console.log('4. Criando cliente admin');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    console.log('5. Verificando se usuário é admin (user_id:', user.id, ')');
    const { data: adminPlayer, error: adminError } = await supabaseAdmin
      .from('players')
      .select('id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (adminError) {
      console.error('Erro ao verificar admin:', adminError);
      throw new Error('Erro ao verificar permissões: ' + adminError.message);
    }

    console.log('6. Admin player:', adminPlayer, 'role raw:', adminPlayer?.role, 'type:', typeof adminPlayer?.role);

    if (!adminPlayer) {
      throw new Error('Perfil de jogador não encontrado para este utilizador. Confirma que tens uma linha na tabela players com user_id igual ao teu utilizador Auth.');
    }

    const role = adminPlayer.role;
    const roleStr = role != null ? String(role).trim().toLowerCase() : '';
    const isAdmin =
      role === 'admin' ||
      role === 4 ||
      role === '4' ||
      roleStr === 'admin' ||
      roleStr === '4' ||
      roleStr === 'administrator' ||
      roleStr === 'administrador';
    if (!isAdmin) {
      throw new Error('Apenas administradores podem redefinir passwords. (O teu role na BD é: ' + JSON.stringify(role) + ')');
    }

    console.log('7. Parseando body da requisição');
    let body: { playerId?: string };
    try {
      body = await req.json();
    } catch {
      throw new Error('Body inválido ou vazio. Envia JSON com a propriedade playerId.');
    }
    const playerId = body?.playerId;
    if (!playerId || typeof playerId !== 'string') {
      throw new Error('Player ID é obrigatório (propriedade "playerId" no body)');
    }
    console.log('8. Player ID:', playerId);

    console.log('8. Buscando jogador alvo');
    const { data: targetPlayer, error: playerError } = await supabaseAdmin
      .from('players')
      .select('user_id, name, phone')
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

    const newPassword = generateRandomPassword(8);
    console.log('10. Atualizando password no Auth (8 caracteres aleatórios)');
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetPlayer.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Erro ao atualizar password:', updateError);
      throw new Error('Erro ao atualizar password: ' + updateError.message);
    }

    console.log('11. Password atualizada com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        password: newPassword,
        playerName: targetPlayer.name,
        phone: targetPlayer.phone ?? null,
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
    const message = error instanceof Error ? error.message : 'Erro ao redefinir password';
    return new Response(
      JSON.stringify({ success: false, error: message }),
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
