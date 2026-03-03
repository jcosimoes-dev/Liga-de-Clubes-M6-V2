import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TestUser {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'jogador' | 'capitao' | 'coordenador';
  federation_points: number;
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
      .select('role, team_id')
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

    const body = await req.json();
    const teamId = body?.team_id || '00000000-0000-0000-0000-000000000001';

    const defaultPassword = 'teste123456';

    const timestamp = Date.now();
    const uniqueSuffix = Math.floor(timestamp / 1000);

    const firstNames = ['Tiago', 'Beatriz', 'Gonçalo', 'Inês', 'Miguel', 'Sara', 'André', 'Catarina', 'Rui', 'Mariana'];
    const lastNames = ['Ferreira', 'Almeida', 'Martins', 'Oliveira', 'Sousa', 'Lopes', 'Fernandes', 'Pinto', 'Carvalho', 'Ribeiro'];

    const getRandomName = (index: number) => {
      const firstIdx = (index + Math.floor(timestamp / 10000)) % firstNames.length;
      const lastIdx = (index + Math.floor(timestamp / 5000)) % lastNames.length;
      return `${firstNames[firstIdx]} ${lastNames[lastIdx]} ${index + 1}`;
    };

    const testUsers: TestUser[] = [
      {
        email: `jogador1_${uniqueSuffix}@m6.test`,
        password: defaultPassword,
        name: getRandomName(0),
        phone: `9123${uniqueSuffix.toString().slice(-5)}`,
        role: 'jogador',
        federation_points: 1200,
      },
      {
        email: `jogador2_${uniqueSuffix}@m6.test`,
        password: defaultPassword,
        name: getRandomName(1),
        phone: `9124${uniqueSuffix.toString().slice(-5)}`,
        role: 'jogador',
        federation_points: 1350,
      },
      {
        email: `jogador3_${uniqueSuffix}@m6.test`,
        password: defaultPassword,
        name: getRandomName(2),
        phone: `9125${uniqueSuffix.toString().slice(-5)}`,
        role: 'jogador',
        federation_points: 1100,
      },
      {
        email: `jogador4_${uniqueSuffix}@m6.test`,
        password: defaultPassword,
        name: getRandomName(3),
        phone: `9126${uniqueSuffix.toString().slice(-5)}`,
        role: 'jogador',
        federation_points: 1450,
      },
      {
        email: `jogador5_${uniqueSuffix}@m6.test`,
        password: defaultPassword,
        name: getRandomName(4),
        phone: `9127${uniqueSuffix.toString().slice(-5)}`,
        role: 'jogador',
        federation_points: 1000,
      },
      {
        email: `capitao_${uniqueSuffix}@m6.test`,
        password: defaultPassword,
        name: getRandomName(5),
        phone: `9128${uniqueSuffix.toString().slice(-5)}`,
        role: 'capitao',
        federation_points: 1500,
      },
      {
        email: `coordenador_${uniqueSuffix}@m6.test`,
        password: defaultPassword,
        name: getRandomName(6),
        phone: `9129${uniqueSuffix.toString().slice(-5)}`,
        role: 'coordenador',
        federation_points: 0,
      },
    ];

    const createdUsers = [];
    const errors = [];

    for (const testUser of testUsers) {
      try {
        const { data: existingPlayer } = await supabaseClient
          .from('players')
          .select('id, user_id, role')
          .eq('email', testUser.email)
          .maybeSingle();

        if (existingPlayer) {
          if (existingPlayer.role !== testUser.role) {
            await supabaseClient
              .from('players')
              .update({ role: testUser.role })
              .eq('id', existingPlayer.id);
          }

          createdUsers.push({
            email: testUser.email,
            password: testUser.password,
            role: testUser.role,
            name: testUser.name,
            status: 'já_existe',
          });
          continue;
        }

        const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
          email: testUser.email,
          password: testUser.password,
          email_confirm: true,
          user_metadata: {
            name: testUser.name,
          },
        });

        if (authError) {
          errors.push({ email: testUser.email, error: authError.message });
          continue;
        }

        const { data: insertedPlayer, error: playerError } = await supabaseClient.from('players').insert({
          user_id: authData.user.id,
          name: testUser.name,
          email: testUser.email,
          phone: testUser.phone,
          role: testUser.role,
          team_id: teamId,
          federation_points: testUser.federation_points,
          is_active: true,
        }).select();

        if (playerError) {
          console.error('Player insert error:', playerError);
          errors.push({
            email: testUser.email,
            error: playerError.message,
            details: playerError.details || '',
            hint: playerError.hint || '',
            code: playerError.code || ''
          });
          continue;
        }

        createdUsers.push({
          email: testUser.email,
          password: testUser.password,
          role: testUser.role,
          name: testUser.name,
          status: 'criado',
        });
      } catch (err) {
        errors.push({
          email: testUser.email,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        users: createdUsers,
        errors: errors.length > 0 ? errors : undefined,
        password: defaultPassword,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Erro ao criar utilizadores de teste',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
