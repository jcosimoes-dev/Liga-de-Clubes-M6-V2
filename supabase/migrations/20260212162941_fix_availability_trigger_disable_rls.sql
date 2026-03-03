/*
  # Fix Availability Trigger - Disable RLS

  ## Summary
  Adiciona SET row_security = off à função create_availabilities_for_new_game
  para garantir que não há recursão ao consultar a tabela players.

  ## Changes
  Adiciona SET row_security = off à função do trigger
*/

CREATE OR REPLACE FUNCTION create_availabilities_for_new_game()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Criar availability apenas para jogadores e capitães activos
  -- EXCLUIR coordenadores e admins (não jogam)
  INSERT INTO availabilities (game_id, player_id, status)
  SELECT NEW.id, id, 'sem_resposta'
  FROM players
  WHERE is_active = true
  AND role IN ('jogador', 'capitao')
  AND team_id = NEW.team_id;
  
  RETURN NEW;
END;
$$;
