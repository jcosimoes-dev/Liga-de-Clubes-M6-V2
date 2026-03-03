/*
  # Adicionar sistema de pontuação aos jogos

  1. Alterações na tabela `games`
    - `team_points` (integer, nullable) - pontos da equipa no jogo
      - Liga de Clubes: 3 (vitória), 1 (derrota), 0 (falta comparência)
      - Torneio: entrada manual
      - Treino: sempre null (não conta pontos)
    - `no_show` (boolean, default false) - indica se houve falta de comparência (0 pontos)

  2. Notas importantes
    - Para Liga de Clubes: pontos calculados automaticamente (3/1/0)
    - Para Torneio: capitão insere manualmente
    - Para Treino: campo permanece null (não aplicável)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'team_points'
  ) THEN
    ALTER TABLE games ADD COLUMN team_points integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'no_show'
  ) THEN
    ALTER TABLE games ADD COLUMN no_show boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Índice para consultas de pontuação
CREATE INDEX IF NOT EXISTS idx_games_team_points ON games(team_points) WHERE team_points IS NOT NULL;
