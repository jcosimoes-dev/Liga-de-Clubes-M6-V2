/*
  # Estender phase e pontuação Liga (3-1-0)

  1. Phase
    - Alargar CHECK de phase para: Qualificação, Regionais, Nacionais, Torneio, Mix, Treino
    - Corrige 422: frontend enviava 'Liga'/'Torneio'/'Mix'/'Treino' não permitidos

  2. Pontuação Liga (apenas para phase IN (Qualificação, Regionais, Nacionais))
    - Vitória: 3 pontos (team_points)
    - Derrota: 1 ponto
    - Falta de comparência (no_show): 0 pontos
    - Trigger ao marcar jogo concluído define team_points conforme resultados ou no_show
*/

-- Remover constraint antiga de phase
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_phase_check;

-- Nova constraint: phase pode ser subcategoria Liga ou tipo de jogo
ALTER TABLE games
  ADD CONSTRAINT games_phase_check
  CHECK (phase IN (
    'Qualificação', 'Regionais', 'Nacionais',
    'Torneio', 'Mix', 'Treino'
  ));

-- Função: definir team_points ao concluir jogo (apenas Liga)
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
BEGIN
  IF NEW.status != 'concluido' OR (OLD.status IS NOT NULL AND OLD.status = 'concluido') THEN
    RETURN NEW;
  END IF;

  is_liga := NEW.phase IN ('Qualificação', 'Regionais', 'Nacionais');

  IF NOT is_liga THEN
    RETURN NEW;
  END IF;

  IF NEW.no_show = true THEN
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

-- Trigger BEFORE UPDATE para definir team_points (BEFORE para poder alterar NEW)
DROP TRIGGER IF EXISTS set_team_points_on_game_complete_trigger ON games;
CREATE TRIGGER set_team_points_on_game_complete_trigger
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION set_team_points_on_game_complete();
