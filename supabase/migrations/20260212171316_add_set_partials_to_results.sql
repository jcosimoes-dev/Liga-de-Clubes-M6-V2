/*
  # Add Set Partial Scores to Results

  ## Summary
  Adds columns to store individual set scores (partials) and implements automatic calculation
  of sets won/lost based on the partials. Also includes validation logic.

  ## New Columns
  - set1_pair_score: Score of the pair in set 1
  - set1_opponent_score: Score of the opponent in set 1
  - set2_pair_score: Score of the pair in set 2
  - set2_opponent_score: Score of the opponent in set 2
  - set3_pair_score: Score of the pair in set 3 (optional)
  - set3_opponent_score: Score of the opponent in set 3 (optional)

  ## Validation Rules
  1. Set scores must be valid tennis scores (6-0, 6-1, 6-2, 6-3, 6-4, 7-5, 7-6, etc.)
  2. A set must be won by at least 2 games difference (except tie-break at 7-6)
  3. Sets cannot exceed 7 games (except with tie-break)
  4. If a pair wins 2 sets, set 3 must not be played
  5. Match must have at least 2 sets

  ## Automatic Calculations
  - sets_won and sets_lost are automatically calculated from the partials
  - Player federation points are updated when game is completed
*/

-- ============================================================
-- Add Set Partial Columns
-- ============================================================

ALTER TABLE results
ADD COLUMN IF NOT EXISTS set1_pair_score INTEGER,
ADD COLUMN IF NOT EXISTS set1_opponent_score INTEGER,
ADD COLUMN IF NOT EXISTS set2_pair_score INTEGER,
ADD COLUMN IF NOT EXISTS set2_opponent_score INTEGER,
ADD COLUMN IF NOT EXISTS set3_pair_score INTEGER,
ADD COLUMN IF NOT EXISTS set3_opponent_score INTEGER;

-- ============================================================
-- Validation Function for Tennis Set Scores
-- ============================================================

CREATE OR REPLACE FUNCTION validate_tennis_set(score1 INTEGER, score2 INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Null scores are not valid
  IF score1 IS NULL OR score2 IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Scores must be non-negative
  IF score1 < 0 OR score2 < 0 THEN
    RETURN FALSE;
  END IF;

  -- One score must be at least 6
  IF score1 < 6 AND score2 < 6 THEN
    RETURN FALSE;
  END IF;

  -- Valid winning scores: 6-0, 6-1, 6-2, 6-3, 6-4, 7-5, 7-6
  IF score1 = 6 THEN
    RETURN score2 >= 0 AND score2 <= 4;
  ELSIF score1 = 7 THEN
    RETURN score2 = 5 OR score2 = 6;
  ELSIF score2 = 6 THEN
    RETURN score1 >= 0 AND score1 <= 4;
  ELSIF score2 = 7 THEN
    RETURN score1 = 5 OR score1 = 6;
  END IF;

  -- No other combinations are valid
  RETURN FALSE;
END;
$$;

-- ============================================================
-- Function to Calculate Sets Won/Lost from Partials
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_sets_from_partials(
  set1_pair INTEGER,
  set1_opp INTEGER,
  set2_pair INTEGER,
  set2_opp INTEGER,
  set3_pair INTEGER,
  set3_opp INTEGER,
  OUT sets_won INTEGER,
  OUT sets_lost INTEGER,
  OUT is_valid BOOLEAN,
  OUT error_message TEXT
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  set1_won BOOLEAN;
  set2_won BOOLEAN;
  set3_won BOOLEAN;
  total_sets_pair INTEGER := 0;
  total_sets_opp INTEGER := 0;
BEGIN
  is_valid := TRUE;
  error_message := NULL;

  -- Validate Set 1 (mandatory)
  IF set1_pair IS NULL OR set1_opp IS NULL THEN
    is_valid := FALSE;
    error_message := 'Set 1 é obrigatório';
    RETURN;
  END IF;

  IF NOT validate_tennis_set(set1_pair, set1_opp) THEN
    is_valid := FALSE;
    error_message := 'Set 1 tem um resultado inválido';
    RETURN;
  END IF;

  -- Validate Set 2 (mandatory)
  IF set2_pair IS NULL OR set2_opp IS NULL THEN
    is_valid := FALSE;
    error_message := 'Set 2 é obrigatório';
    RETURN;
  END IF;

  IF NOT validate_tennis_set(set2_pair, set2_opp) THEN
    is_valid := FALSE;
    error_message := 'Set 2 tem um resultado inválido';
    RETURN;
  END IF;

  -- Calculate who won each set
  set1_won := set1_pair > set1_opp;
  set2_won := set2_pair > set2_opp;

  -- Count sets won by each pair
  IF set1_won THEN
    total_sets_pair := total_sets_pair + 1;
  ELSE
    total_sets_opp := total_sets_opp + 1;
  END IF;

  IF set2_won THEN
    total_sets_pair := total_sets_pair + 1;
  ELSE
    total_sets_opp := total_sets_opp + 1;
  END IF;

  -- Check if match is already decided (2-0)
  IF total_sets_pair = 2 OR total_sets_opp = 2 THEN
    -- Match is decided, set 3 should not be played
    IF set3_pair IS NOT NULL OR set3_opp IS NOT NULL THEN
      is_valid := FALSE;
      error_message := 'Set 3 não deve ser jogado quando o resultado já é 2-0';
      RETURN;
    END IF;
  ELSE
    -- Match is 1-1, set 3 is mandatory
    IF set3_pair IS NULL OR set3_opp IS NULL THEN
      is_valid := FALSE;
      error_message := 'Set 3 é obrigatório quando o resultado está 1-1';
      RETURN;
    END IF;

    IF NOT validate_tennis_set(set3_pair, set3_opp) THEN
      is_valid := FALSE;
      error_message := 'Set 3 tem um resultado inválido';
      RETURN;
    END IF;

    set3_won := set3_pair > set3_opp;
    IF set3_won THEN
      total_sets_pair := total_sets_pair + 1;
    ELSE
      total_sets_opp := total_sets_opp + 1;
    END IF;
  END IF;

  -- Return the final counts
  sets_won := total_sets_pair;
  sets_lost := total_sets_opp;
END;
$$;

-- ============================================================
-- Trigger to Auto-Calculate Sets Won/Lost
-- ============================================================

CREATE OR REPLACE FUNCTION auto_calculate_sets_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  calc_result RECORD;
BEGIN
  -- Calculate sets from partials
  SELECT * INTO calc_result
  FROM calculate_sets_from_partials(
    NEW.set1_pair_score,
    NEW.set1_opponent_score,
    NEW.set2_pair_score,
    NEW.set2_opponent_score,
    NEW.set3_pair_score,
    NEW.set3_opponent_score
  );

  -- If validation failed, raise an error
  IF NOT calc_result.is_valid THEN
    RAISE EXCEPTION '%', calc_result.error_message;
  END IF;

  -- Set the calculated values
  NEW.sets_won := calc_result.sets_won;
  NEW.sets_lost := calc_result.sets_lost;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS auto_calculate_sets_result_trigger ON results;

-- Create trigger to auto-calculate before insert or update
CREATE TRIGGER auto_calculate_sets_result_trigger
  BEFORE INSERT OR UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_sets_result();
