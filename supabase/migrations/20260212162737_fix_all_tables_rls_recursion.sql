/*
  # Fix All Tables RLS Recursion

  ## Summary
  Remove get_current_user_role() de TODAS as políticas RLS para evitar recursão.
  Cria funções helper específicas que não causam recursão.

  ## Problem
  Qualquer uso de get_current_user_role() em políticas RLS pode causar recursão
  porque essa função consulta a tabela players.

  ## Solution
  Criar funções helper SQL simples que verificam roles sem recursão.

  ## Changes
  Remove e recria políticas para: games, pairs, availabilities, results, teams
*/

-- ============================================================
-- HELPER FUNCTIONS (SQL simples, sem recursão)
-- ============================================================

CREATE OR REPLACE FUNCTION is_user_captain()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE user_id = auth.uid()
    AND role = 'capitao'
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION is_user_captain_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE user_id = auth.uid()
    AND role IN ('capitao', 'admin')
    LIMIT 1
  );
$$;

-- ============================================================
-- GAMES TABLE
-- ============================================================

DROP POLICY IF EXISTS "Captains and admins can create games" ON games;
DROP POLICY IF EXISTS "Captains and admins can update games" ON games;
DROP POLICY IF EXISTS "Only admins can delete games" ON games;

CREATE POLICY "Captains and admins can create games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (is_user_captain_or_admin());

CREATE POLICY "Captains and admins can update games"
  ON games FOR UPDATE TO authenticated
  USING (is_user_captain_or_admin())
  WITH CHECK (is_user_captain_or_admin());

CREATE POLICY "Only admins can delete games"
  ON games FOR DELETE TO authenticated
  USING (is_user_admin());

-- ============================================================
-- PAIRS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Captains and admins can view all pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can create pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can update pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can delete pairs" ON pairs;

CREATE POLICY "Captains and admins can view all pairs"
  ON pairs FOR SELECT TO authenticated
  USING (is_user_captain_or_admin());

CREATE POLICY "Captains and admins can create pairs"
  ON pairs FOR INSERT TO authenticated
  WITH CHECK (is_user_captain_or_admin());

CREATE POLICY "Captains and admins can update pairs"
  ON pairs FOR UPDATE TO authenticated
  USING (is_user_captain_or_admin())
  WITH CHECK (is_user_captain_or_admin());

CREATE POLICY "Captains and admins can delete pairs"
  ON pairs FOR DELETE TO authenticated
  USING (is_user_captain_or_admin());

-- ============================================================
-- AVAILABILITIES TABLE
-- ============================================================

DROP POLICY IF EXISTS "Admins and captains can update all availabilities" ON availabilities;

CREATE POLICY "Admins and captains can update all availabilities"
  ON availabilities FOR UPDATE TO authenticated
  USING (is_user_captain_or_admin())
  WITH CHECK (is_user_captain_or_admin());

-- ============================================================
-- RESULTS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Captains and admins can view all results" ON results;
DROP POLICY IF EXISTS "Captains and admins can create results" ON results;
DROP POLICY IF EXISTS "Captains and admins can update results" ON results;
DROP POLICY IF EXISTS "Only admins can delete results" ON results;

CREATE POLICY "Captains and admins can view all results"
  ON results FOR SELECT TO authenticated
  USING (is_user_captain_or_admin());

CREATE POLICY "Captains and admins can create results"
  ON results FOR INSERT TO authenticated
  WITH CHECK (is_user_captain_or_admin());

CREATE POLICY "Captains and admins can update results"
  ON results FOR UPDATE TO authenticated
  USING (is_user_captain_or_admin())
  WITH CHECK (is_user_captain_or_admin());

CREATE POLICY "Only admins can delete results"
  ON results FOR DELETE TO authenticated
  USING (is_user_admin());

-- ============================================================
-- TEAMS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Captains and admins can create teams" ON teams;
DROP POLICY IF EXISTS "Captains and admins can update teams" ON teams;
DROP POLICY IF EXISTS "Only admins can delete teams" ON teams;

CREATE POLICY "Captains and admins can create teams"
  ON teams FOR INSERT TO authenticated
  WITH CHECK (is_user_captain_or_admin());

CREATE POLICY "Captains and admins can update teams"
  ON teams FOR UPDATE TO authenticated
  USING (is_user_captain_or_admin())
  WITH CHECK (is_user_captain_or_admin());

CREATE POLICY "Only admins can delete teams"
  ON teams FOR DELETE TO authenticated
  USING (is_user_admin());
