/*
  # Fix Pairs SELECT Policy Recursion

  ## Summary
  Remove subquery da política SELECT para evitar recursão.
  Usa função helper que já tem SECURITY DEFINER.

  ## Changes
  - Remove política antiga com subquery
  - Cria função helper para verificar se o jogador é dono do pair
  - Cria nova política sem recursão
*/

-- Create helper function to check if user owns the pair
CREATE OR REPLACE FUNCTION user_owns_pair(pair_player1_id UUID, pair_player2_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  current_player_id UUID;
BEGIN
  SELECT id INTO current_player_id
  FROM players
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN (pair_player1_id = current_player_id OR pair_player2_id = current_player_id);
END;
$$;

-- Drop old recursive policy
DROP POLICY IF EXISTS "Players can view own pairs" ON pairs;

-- Create new non-recursive policy
CREATE POLICY "Players can view own pairs"
  ON pairs FOR SELECT TO authenticated
  USING (user_owns_pair(player1_id, player2_id));
