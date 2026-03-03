/*
  # Remover referências a sets_won/sets_lost (colunas não existem em results)

  1) Trigger auto_calculate_sets_result: só valida (set1_casa/fora, etc.), não escreve sets_won/sets_lost.
  2) set_team_points_on_game_complete: calcular totais a partir de set1_casa, set1_fora, set2_casa, set2_fora, set3_casa, set3_fora.
*/

-- 1) Trigger em results: validar sets mas NÃO atribuir NEW.sets_won / NEW.sets_lost
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

  RETURN NEW;
END;
$$;

-- 2) Pontos de equipa ao concluir jogo: usar set1_casa/fora, set2, set3 em vez de sets_won/sets_lost
CREATE OR REPLACE FUNCTION set_team_points_on_game_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  total_won integer;
  total_lost integer;
  is_liga boolean;
  no_show_val boolean := false;
BEGIN
  IF NEW.status != 'concluido' OR (OLD.status IS NOT NULL AND OLD.status = 'concluido') THEN
    RETURN NEW;
  END IF;

  is_liga := NEW.phase IN ('Qualificação', 'Regionais', 'Nacionais');

  IF NOT is_liga THEN
    RETURN NEW;
  END IF;

  BEGIN
    no_show_val := COALESCE(NEW.no_show, false);
  EXCEPTION WHEN SQLSTATE '42703' THEN
    no_show_val := false;
  END;

  IF no_show_val = true THEN
    NEW.team_points := 0;
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(SUM(won), 0),
    COALESCE(SUM(lost), 0)
  INTO total_won, total_lost
  FROM (
    SELECT
      (CASE WHEN COALESCE(r.set1_casa, 0) > COALESCE(r.set1_fora, 0) THEN 1 ELSE 0 END
       + CASE WHEN COALESCE(r.set2_casa, 0) > COALESCE(r.set2_fora, 0) THEN 1 ELSE 0 END
       + CASE WHEN r.set3_casa IS NOT NULL AND r.set3_fora IS NOT NULL AND COALESCE(r.set3_casa, 0) > COALESCE(r.set3_fora, 0) THEN 1 ELSE 0 END) AS won,
      (CASE WHEN COALESCE(r.set1_casa, 0) < COALESCE(r.set1_fora, 0) THEN 1 ELSE 0 END
       + CASE WHEN COALESCE(r.set2_casa, 0) < COALESCE(r.set2_fora, 0) THEN 1 ELSE 0 END
       + CASE WHEN r.set3_casa IS NOT NULL AND r.set3_fora IS NOT NULL AND COALESCE(r.set3_casa, 0) < COALESCE(r.set3_fora, 0) THEN 1 ELSE 0 END) AS lost
    FROM results r
    WHERE r.game_id = NEW.id
  ) t;

  IF total_won > total_lost THEN
    NEW.team_points := 3;
  ELSIF total_won < total_lost THEN
    NEW.team_points := 1;
  ELSE
    NEW.team_points := NULL;
  END IF;

  RETURN NEW;
END;
$$;
