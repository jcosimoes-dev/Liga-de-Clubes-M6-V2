/*
  # Corrigir erro 42703: record "new" has no field "no_show"

  A tabela games pode não ter a coluna no_show; o trigger set_team_points_on_game_complete
  referencia NEW.no_show e falha. Este script:
  1) Adiciona no_show a games se não existir.
  2) Recreia a função do trigger para ser defensiva (usa no_show só se existir).
*/

-- 1) Garantir que a coluna no_show existe em games
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'no_show'
  ) THEN
    ALTER TABLE games ADD COLUMN no_show boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- 2) Função do trigger defensiva: não referencia no_show se a coluna não existir na linha
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

  -- Usar no_show apenas se a coluna existir (evita 42703)
  BEGIN
    no_show_val := COALESCE(NEW.no_show, false);
  EXCEPTION WHEN SQLSTATE '42703' THEN
    no_show_val := false;
  END;

  IF no_show_val = true THEN
    NEW.team_points := 0;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(r.sets_won), 0), COALESCE(SUM(r.sets_lost), 0)
  INTO total_won, total_lost
  FROM results r
  WHERE r.game_id = NEW.id;

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
