/*
  # Atualizar trigger de results para colunas set1_casa, set1_fora, etc.

  O trigger auto_calculate_sets_result calcula sets_won e sets_lost a partir dos
  scores dos sets. Passa a usar set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora.
*/

CREATE OR REPLACE FUNCTION auto_calculate_sets_result()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  calc_result RECORD;
  s1_pair integer;
  s1_opp integer;
  s2_pair integer;
  s2_opp integer;
  s3_pair integer;
  s3_opp integer;
BEGIN
  s1_pair := COALESCE(NEW.set1_casa, NEW.set1_pair_score);
  s1_opp := COALESCE(NEW.set1_fora, NEW.set1_opponent_score);
  s2_pair := COALESCE(NEW.set2_casa, NEW.set2_pair_score);
  s2_opp := COALESCE(NEW.set2_fora, NEW.set2_opponent_score);
  s3_pair := COALESCE(NEW.set3_casa, NEW.set3_pair_score);
  s3_opp := COALESCE(NEW.set3_fora, NEW.set3_opponent_score);

  SELECT * INTO calc_result
  FROM calculate_sets_from_partials(
    s1_pair, s1_opp, s2_pair, s2_opp, s3_pair, s3_opp
  );

  IF NOT calc_result.is_valid THEN
    RAISE EXCEPTION '%', calc_result.error_message;
  END IF;

  NEW.sets_won := calc_result.sets_won;
  NEW.sets_lost := calc_result.sets_lost;

  RETURN NEW;
END;
$$;
