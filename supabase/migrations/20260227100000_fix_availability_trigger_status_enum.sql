/*
  # Fix: availability_status enum — usar 'undecided' em vez de 'sem_resposta'

  O enum availability_status tem valores: confirmed, declined, undecided.
  O trigger usava 'sem_resposta' (ou 'no_response'), causando 22P02.
  Corrige o trigger para usar 'undecided' (estado inicial = Indeciso).
*/

CREATE OR REPLACE FUNCTION create_availabilities_for_new_game()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO availabilities (game_id, player_id, status)
  SELECT NEW.id, id, 'undecided'
  FROM players
  WHERE is_active = true
  AND role = 'player'
  AND team_id = NEW.team_id;
  RETURN NEW;
END;
$$;
