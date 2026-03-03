/*
  # Fix All Players Policies Recursion

  ## Summary
  Remove TODAS as políticas da tabela players que usam get_current_user_role()
  para evitar recursão infinita.
  
  ## Problem
  A função get_current_user_role() consulta a tabela players, mas as políticas
  da tabela players também usam get_current_user_role(), criando recursão infinita.

  ## Solution
  Substituir políticas por verificações diretas sem usar a função recursiva.

  ## Changes
  1. Remove políticas antigas que usam get_current_user_role()
  2. Cria novas políticas usando comparações diretas de user_id
  3. Para operações de admin, usa uma função helper segura
*/

-- Create helper function to check admin without recursion
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE user_id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$$;

-- DROP all old recursive policies
DROP POLICY IF EXISTS "Admins can view all players" ON players;
DROP POLICY IF EXISTS "Admins can create any player" ON players;
DROP POLICY IF EXISTS "Admins can update any player" ON players;
DROP POLICY IF EXISTS "Admins can delete any player" ON players;

-- CREATE new non-recursive admin policies
CREATE POLICY "Admins can view all players"
  ON players FOR SELECT TO authenticated
  USING (is_user_admin());

CREATE POLICY "Admins can create any player"
  ON players FOR INSERT TO authenticated
  WITH CHECK (is_user_admin());

CREATE POLICY "Admins can update any player"
  ON players FOR UPDATE TO authenticated
  USING (is_user_admin())
  WITH CHECK (is_user_admin());

CREATE POLICY "Admins can delete any player"
  ON players FOR DELETE TO authenticated
  USING (is_user_admin());
