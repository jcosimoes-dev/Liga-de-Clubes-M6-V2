/*
  # Fix Results Policy - Remove Recursion

  ## Summary
  Remove subquery complexa da política SELECT em results que consulta players.

  ## Problem
  A política "Players can view results for their games" tem uma subquery
  aninhada que consulta players, causando recursão.

  ## Solution
  Criar função helper que verifica se o user participa no jogo.

  ## Changes
  Remove política antiga e cria nova com função helper.
*/

-- Helper function to check if user is in a game
CREATE OR REPLACE FUNCTION user_is_in_game(p_game_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pairs
    WHERE game_id = p_game_id
    AND (
      player1_id = (SELECT id FROM players WHERE user_id = auth.uid() LIMIT 1)
      OR
      player2_id = (SELECT id FROM players WHERE user_id = auth.uid() LIMIT 1)
    )
  );
$$;

-- Fix results policy
DROP POLICY IF EXISTS "Players can view results for their games" ON results;

CREATE POLICY "Players can view results for their games"
  ON results FOR SELECT TO authenticated
  USING (user_is_in_game(game_id));
