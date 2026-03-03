/*
  # Garantir constraint preferred_side: apenas 'left', 'right', 'both'

  Se a constraint existir com outra definição (ex.: valores em português),
  é removida e recriada com os valores esperados pela aplicação.
*/

ALTER TABLE players
  DROP CONSTRAINT IF EXISTS players_preferred_side_check;

ALTER TABLE players
  ADD CONSTRAINT players_preferred_side_check
  CHECK (preferred_side IN ('left', 'right', 'both'));
