/*
  # Fix All Subquery Policies - Remove Recursion

  ## Summary
  Remove TODAS as subqueries das políticas RLS que consultam a tabela players.
  Substitui por funções helper que usam SET row_security = off.

  ## Problem
  Políticas nas tabelas availabilities e outras têm subqueries como:
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  
  Quando essas subqueries executam, ativam as políticas RLS da tabela players,
  que podem chamar funções helper, criando recursão infinita.

  ## Solution
  Criar função helper get_current_player_id() e usar em todas as políticas.

  ## Changes
  1. Criar função helper get_current_player_id()
  2. Remover políticas com subqueries
  3. Recriar políticas usando a função helper
*/

-- ============================================================
-- HELPER FUNCTION para obter ID do jogador atual
-- ============================================================

CREATE OR REPLACE FUNCTION get_current_player_id()
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

-- ============================================================
-- FIX AVAILABILITIES POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Players can create own availability" ON availabilities;
DROP POLICY IF EXISTS "Players can update own availability" ON availabilities;
DROP POLICY IF EXISTS "Players can delete own availability" ON availabilities;

CREATE POLICY "Players can create own availability"
  ON availabilities FOR INSERT TO authenticated
  WITH CHECK (player_id = get_current_player_id());

CREATE POLICY "Players can update own availability"
  ON availabilities FOR UPDATE TO authenticated
  USING (player_id = get_current_player_id())
  WITH CHECK (player_id = get_current_player_id());

CREATE POLICY "Players can delete own availability"
  ON availabilities FOR DELETE TO authenticated
  USING (player_id = get_current_player_id());
