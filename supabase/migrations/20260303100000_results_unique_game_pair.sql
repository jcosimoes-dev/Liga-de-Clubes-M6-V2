/*
  # Unique constraint para upsert por (game_id, pair_id)

  Permite um resultado por dupla por jogo. Remove o unique só em game_id (se existir)
  e cria UNIQUE(game_id, pair_id) para o upsert com onConflict: 'game_id,pair_id'.
*/

-- Remover constraint antiga que só tinha game_id (se existir)
ALTER TABLE results DROP CONSTRAINT IF EXISTS results_game_id_key;

-- Garantir que existe um único resultado por (game_id, pair_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.results'::regclass
      AND conname = 'results_game_id_pair_id_key'
      AND contype = 'u'
  ) THEN
    ALTER TABLE results
      ADD CONSTRAINT results_game_id_pair_id_key UNIQUE (game_id, pair_id);
  END IF;
END $$;
