/*
  # Fix Auto-Update Points Trigger

  ## Summary
  Fixes the trigger that updates player points when a game is completed.
  The trigger was checking the wrong field (phase instead of status).

  ## Changes
  - Update trigger to check status field instead of phase field
  - Status changes to 'concluido' when game is completed
  - Phase remains as 'Liga de Clubes', 'Torneio', or 'Treino'
*/

-- ============================================================
-- Fix Trigger Function
-- ============================================================

CREATE OR REPLACE FUNCTION auto_update_points_on_game_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Check if status changed to 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') THEN
    -- Update player points
    PERFORM update_player_points_for_game(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;
