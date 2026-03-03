/*
  # Garantir coluna team_points em games (evita 42703 ao gravar resultados)

  1) Adiciona team_points a games se não existir.
  2) Recreia o trigger para ser defensivo: se team_points não existir, ignora sem falhar.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'team_points'
  ) THEN
    ALTER TABLE games ADD COLUMN team_points integer;
  END IF;
END $$;

-- Trigger defensivo: não falha se team_points não existir
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
  pts integer;
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
    pts := 0;
  ELSE
    pts := NULL;
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
      pts := 3;
    ELSIF total_won < total_lost THEN
      pts := 1;
    ELSE
      pts := NULL;
    END IF;
  END IF;

  BEGIN
    NEW.team_points := pts;
  EXCEPTION WHEN SQLSTATE '42703' THEN
    NULL;  -- coluna team_points não existe, ignora
  END;

  RETURN NEW;
END;
$$;
