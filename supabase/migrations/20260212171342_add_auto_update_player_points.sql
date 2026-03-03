/*
  # Auto-Update Player Points When Game Completed

  ## Summary
  Implements automatic update of player federation points when a game is marked as completed.
  Points are calculated based on sets won/lost in each match.

  ## Point System
  - Win a match (2-0 or 2-1): Each player in the winning pair gets +3 points
  - Lose a match (0-2 or 1-2): Each player in the losing pair gets +1 point
  - Points are added to the current federation_points of each player

  ## Functions
  1. update_player_points_for_game: Updates points for all players in a game
  2. Trigger on games table to call the function when phase changes to 'concluido'
*/

-- ============================================================
-- Function to Update Player Points for a Completed Game
-- ============================================================

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
  -- Loop through all results for this game
  FOR result_row IN
    SELECT 
      r.id,
      r.pair_id,
      r.sets_won,
      r.sets_lost
    FROM results r
    WHERE r.game_id = game_id_param
  LOOP
    -- Determine points based on sets won/lost
    IF result_row.sets_won > result_row.sets_lost THEN
      -- Winner gets 3 points
      points_to_add := 3;
    ELSE
      -- Loser gets 1 point
      points_to_add := 1;
    END IF;

    -- Get the pair information
    SELECT player1_id, player2_id INTO pair_row
    FROM pairs
    WHERE id = result_row.pair_id;

    -- Update both players in the pair
    UPDATE players
    SET 
      federation_points = COALESCE(federation_points, 0) + points_to_add,
      points_updated_at = NOW()
    WHERE id IN (pair_row.player1_id, pair_row.player2_id);

  END LOOP;

  -- Also update team_points in the games table
  UPDATE games
  SET 
    team1_points = (
      SELECT COALESCE(SUM(sets_won), 0)
      FROM results r
      JOIN pairs p ON r.pair_id = p.id
      WHERE r.game_id = game_id_param
    ),
    team2_points = (
      SELECT COALESCE(SUM(sets_lost), 0)
      FROM results r
      JOIN pairs p ON r.pair_id = p.id
      WHERE r.game_id = game_id_param
    )
  WHERE id = game_id_param;
END;
$$;

-- ============================================================
-- Trigger to Auto-Update Points When Game is Completed
-- ============================================================

CREATE OR REPLACE FUNCTION auto_update_points_on_game_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Check if phase changed to 'concluido'
  IF NEW.phase = 'concluido' AND (OLD.phase IS NULL OR OLD.phase != 'concluido') THEN
    -- Update player points
    PERFORM update_player_points_for_game(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_update_points_on_game_complete_trigger ON games;

-- Create trigger
CREATE TRIGGER auto_update_points_on_game_complete_trigger
  AFTER UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_points_on_game_complete();
