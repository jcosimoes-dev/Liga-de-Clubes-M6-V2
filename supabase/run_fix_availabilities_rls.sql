/*
  Corrige RLS em availabilities — resolve 403

  Executa no Supabase SQL Editor.
  Cria as funções helper necessárias e as políticas RLS.
*/

-- ============================================================
-- 1. FUNÇÕES HELPER (criar se não existirem)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_current_player_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT id FROM players
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_bypass()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role::text = '4')
  );
$$;

-- ============================================================
-- 2. POLÍTICAS RLS
-- ============================================================

-- SELECT: todos os utilizadores autenticados podem ver todas as disponibilidades
DROP POLICY IF EXISTS "All authenticated users can view availabilities" ON availabilities;
DROP POLICY IF EXISTS "Admins can view all availabilities" ON availabilities;
DROP POLICY IF EXISTS "Captains and admins can view all availabilities" ON availabilities;

CREATE POLICY "All authenticated users can view availabilities"
  ON availabilities FOR SELECT TO authenticated
  USING (true);

-- INSERT: jogadores podem criar a sua própria disponibilidade
DROP POLICY IF EXISTS "Players can create own availability" ON availabilities;
CREATE POLICY "Players can create own availability"
  ON availabilities FOR INSERT TO authenticated
  WITH CHECK (player_id = get_current_player_id());

-- UPDATE: jogadores podem atualizar a sua própria disponibilidade
DROP POLICY IF EXISTS "Players can update own availability" ON availabilities;
DROP POLICY IF EXISTS "Admins can update all availabilities" ON availabilities;
DROP POLICY IF EXISTS "Admins and captains can update all availabilities" ON availabilities;

CREATE POLICY "Players can update own availability"
  ON availabilities FOR UPDATE TO authenticated
  USING (player_id = get_current_player_id())
  WITH CHECK (player_id = get_current_player_id());

CREATE POLICY "Admins can update all availabilities"
  ON availabilities FOR UPDATE TO authenticated
  USING (COALESCE(is_admin_bypass(), false))
  WITH CHECK (true);

-- DELETE: jogadores podem eliminar a sua própria disponibilidade
DROP POLICY IF EXISTS "Players can delete own availability" ON availabilities;
CREATE POLICY "Players can delete own availability"
  ON availabilities FOR DELETE TO authenticated
  USING (player_id = get_current_player_id());
