/*
  # Adicionar RPC para Bootstrap do Primeiro Admin

  1. Alterações
    - Garante que o campo `role` existe na tabela `players`
    - Cria função RPC `bootstrap_first_admin()` que:
      - Verifica se o utilizador está autenticado (auth.uid())
      - Conta quantos admins existem no sistema
      - Se não existir nenhum admin:
        - Cria player para o user_id se não existir
        - OU atualiza o player existente para role='admin'
      - Retorna JSON com resultado da operação

  2. Segurança
    - Função usa `security definer` para ter permissões elevadas
    - Apenas permite promoção quando não existe nenhum admin
    - Requer autenticação (auth.uid() não pode ser null)
    - Permissão concedida a `authenticated` users

  3. Lógica de Auto-Criação
    - Se não existir player com user_id = auth.uid():
      - CRIA novo player com dados do auth.users
      - Define role='admin' diretamente
    - Se já existir player:
      - ATUALIZA role para 'admin'
    - Usa ON CONFLICT para lidar com ambos os casos automaticamente
*/

-- 1) Garantir que existe o campo "role" (se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.players
    ADD COLUMN role text NOT NULL DEFAULT 'jogador';
  END IF;
END $$;

-- 2) Função RPC: promove o utilizador autenticado para admin
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_admins int;
  v_player_id uuid;
BEGIN
  -- Verificar autenticação
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  -- Contar admins actuais
  SELECT count(*) INTO v_admins
  FROM public.players
  WHERE role = 'admin';

  -- Bloquear se já existir admin
  IF v_admins > 0 THEN
    RETURN json_build_object('ok', false, 'error', 'admin_already_exists', 'admins', v_admins);
  END IF;

  -- Criar ou atualizar player para admin
  INSERT INTO public.players (user_id, name, email, role, is_active, created_at, updated_at)
  SELECT
    v_uid,
    COALESCE(au.raw_user_meta_data->>'name', au.email, 'Utilizador'),
    COALESCE(au.email, ''),
    'admin',
    true,
    now(),
    now()
  FROM auth.users au
  WHERE au.id = v_uid
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'admin',
        updated_at = now()
  RETURNING id INTO v_player_id;

  -- Garantir que o role ficou admin (segurança extra)
  UPDATE public.players
  SET role = 'admin',
      updated_at = now()
  WHERE user_id = v_uid;

  RETURN json_build_object('ok', true, 'role', 'admin', 'player_id', v_player_id);
END;
$$;

-- 3) Permissões para chamar a RPC
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;