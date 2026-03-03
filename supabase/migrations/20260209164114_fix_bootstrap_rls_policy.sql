/*
  # Corrigir RLS para Permitir Bootstrap do Primeiro Admin

  1. Problema Identificado
    - A política INSERT em players só permite admins: `is_admin()`
    - Mas para criar o primeiro admin, ainda não existe nenhum admin
    - A RPC `bootstrap_first_admin()` falha com 401 porque viola a política RLS

  2. Solução
    - Adicionar política INSERT que permite auto-criação quando não existe admin
    - Adicionar política UPDATE que permite auto-promoção quando não existe admin
    - Remover UPDATE extra desnecessário da RPC
    - RPC continua com SECURITY DEFINER mas agora as políticas permitem a operação

  3. Segurança
    - Políticas verificam que não existe nenhum admin antes de permitir
    - Apenas o próprio utilizador pode se promover (auth.uid() = user_id)
    - Após criar o primeiro admin, políticas normais aplicam-se

  4. Alterações
    - Adiciona política "Allow bootstrap insert when no admin exists"
    - Adiciona política "Allow bootstrap update when no admin exists"
    - Simplifica RPC removendo UPDATE redundante
*/

-- ============================================
-- POLÍTICA: Permitir auto-criação durante bootstrap
-- ============================================

-- Política INSERT: permite criar player para si próprio se não existir nenhum admin
CREATE POLICY "Allow bootstrap insert when no admin exists"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM players WHERE role = 'admin')
  );

-- Política UPDATE: permite auto-promoção se não existir nenhum admin
CREATE POLICY "Allow bootstrap update when no admin exists"
  ON players
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM players WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM players WHERE role = 'admin')
  );

-- ============================================
-- RPC: Simplificar bootstrap_first_admin
-- ============================================

-- Recriar função RPC sem o UPDATE redundante
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

  -- Contar admins atuais
  SELECT count(*) INTO v_admins
  FROM public.players
  WHERE role = 'admin';

  -- Bloquear se já existir admin
  IF v_admins > 0 THEN
    RETURN json_build_object('ok', false, 'error', 'admin_already_exists', 'admins', v_admins);
  END IF;

  -- Criar ou atualizar player para admin
  -- As políticas RLS agora permitem esta operação quando não existe admin
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

  RETURN json_build_object('ok', true, 'role', 'admin', 'player_id', v_player_id);
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin() TO authenticated;