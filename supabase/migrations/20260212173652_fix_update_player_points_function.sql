/*
  # Fix update_player_points_for_game Function

  ## Summary
  Removes the attempt to update non-existent columns (team1_points, team2_points).
  The games table only has team_points which is calculated and set when results are saved.

  ## Changes
  - Remove the UPDATE games statement that tries to update team1_points and team2_points
  - Keep only the player points update logic
*/

CREATE OR REPLACE FUNCTION update_player_points_for_game(game_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  result_row RECORD;
  pair_row RECORD;
  points_to_add INTEGER;
BEGIN
  FOR result_row IN
    SELECT 
      r.id,
      r.pair_id,
      r.sets_won,
      r.sets_lost
    FROM results r
    WHERE r.game_id = game_id_param
  LOOP
    IF result_row.sets_won > result_row.sets_lost THEN
      points_to_add := 3;
    ELSE
      points_to_add := 1;
    END IF;

    SELECT player1_id, player2_id INTO pair_row
    FROM pairs
    WHERE id = result_row.pair_id;

    UPDATE players
    SET 
      federation_points = COALESCE(federation_points, 0) + points_to_add,
      points_updated_at = NOW()
    WHERE id IN (pair_row.player1_id, pair_row.player2_id);

  END LOOP;
END;
$$;
