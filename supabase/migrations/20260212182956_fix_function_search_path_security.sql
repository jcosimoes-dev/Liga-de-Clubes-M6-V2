/*
  # Fix Function Search Path Security Issues

  1. Problem
    - Several functions have mutable search_path which is a security risk
    - Functions should have immutable search_path to prevent search_path hijacking
  
  2. Solution
    - Add SET search_path = '' to IMMUTABLE functions
    - Add SET search_path = public to SECURITY DEFINER functions
  
  3. Affected Functions
    - validate_tennis_set (IMMUTABLE)
    - calculate_sets_from_partials (IMMUTABLE)
    - promote_first_captain (SECURITY DEFINER)
    - get_team_players_for_admin (no params version)
*/

-- ============================================================
-- Fix validate_tennis_set
-- ============================================================

CREATE OR REPLACE FUNCTION validate_tennis_set(score1 INTEGER, score2 INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF score1 IS NULL OR score2 IS NULL THEN
    RETURN FALSE;
  END IF;

  IF score1 < 0 OR score2 < 0 THEN
    RETURN FALSE;
  END IF;

  IF score1 < 6 AND score2 < 6 THEN
    RETURN FALSE;
  END IF;

  IF score1 = 6 THEN
    RETURN score2 >= 0 AND score2 <= 4;
  ELSIF score1 = 7 THEN
    RETURN score2 = 5 OR score2 = 6;
  ELSIF score2 = 6 THEN
    RETURN score1 >= 0 AND score1 <= 4;
  ELSIF score2 = 7 THEN
    RETURN score1 = 5 OR score1 = 6;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================
-- Fix calculate_sets_from_partials
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
SET search_path = ''
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

  set1_won := set1_pair > set1_opp;
  set2_won := set2_pair > set2_opp;

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

  IF total_sets_pair = 2 OR total_sets_opp = 2 THEN
    IF set3_pair IS NOT NULL OR set3_opp IS NOT NULL THEN
      is_valid := FALSE;
      error_message := 'Set 3 não deve ser jogado quando o resultado já é 2-0';
      RETURN;
    END IF;
  ELSE
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

  sets_won := total_sets_pair;
  sets_lost := total_sets_opp;
END;
$$;

-- ============================================================
-- Fix promote_first_captain
-- ============================================================

CREATE OR REPLACE FUNCTION promote_first_captain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM players) = 0 THEN
    NEW.is_captain := true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- Fix get_team_players_for_admin (no params)
-- ============================================================

CREATE OR REPLACE FUNCTION get_team_players_for_admin()
RETURNS TABLE (
  id UUID,
  name TEXT,
  role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  admin_team_id UUID;
  admin_role TEXT;
BEGIN
  SELECT p.team_id, p.role INTO admin_team_id, admin_role
  FROM players p
  WHERE p.user_id = auth.uid();

  IF admin_role IS NULL OR admin_role != 'admin' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.role
  FROM players p
  WHERE p.team_id = admin_team_id
    AND p.is_active = true
  ORDER BY p.name ASC;
END;
$$;
