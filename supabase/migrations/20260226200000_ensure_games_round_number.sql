/*
  # Garantir coluna round_number na tabela games

  Corrige o erro PGRST284 "Could not find the 'round_number' column of 'games'"
  quando a tabela foi criada sem esta coluna (ex.: via dashboard ou esquema antigo).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'games'
      AND column_name = 'round_number'
  ) THEN
    ALTER TABLE games
      ADD COLUMN round_number integer NOT NULL DEFAULT 1;
    CREATE INDEX IF NOT EXISTS idx_games_round_number ON games(round_number);
  END IF;
END $$;
