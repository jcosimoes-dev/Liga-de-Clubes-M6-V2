-- =============================================================================
-- 2A. PAIRS – Só a tabela, índices e triggers (sem políticas)
-- Correr PRIMEIRO. Requer: public.players e public.games existirem.
-- Cria a função update_updated_at_column se não existir (evita erro 42883).
-- =============================================================================

-- Função necessária para o trigger updated_at (se ainda não existir)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  player1_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  player2_id uuid REFERENCES public.players(id) ON DELETE CASCADE NOT NULL,
  total_points integer DEFAULT 0 NOT NULL,
  pair_order integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CHECK (player1_id != player2_id)
);

CREATE INDEX IF NOT EXISTS idx_pairs_game_id ON pairs(game_id);
CREATE INDEX IF NOT EXISTS idx_pairs_player1_id ON pairs(player1_id);
CREATE INDEX IF NOT EXISTS idx_pairs_player2_id ON pairs(player2_id);
CREATE INDEX IF NOT EXISTS idx_pairs_pair_order ON pairs(pair_order);

DROP TRIGGER IF EXISTS update_pairs_updated_at ON pairs;
CREATE TRIGGER update_pairs_updated_at
  BEFORE UPDATE ON pairs FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION calculate_pair_total_points()
RETURNS TRIGGER AS $$
DECLARE
  player1_points integer;
  player2_points integer;
BEGIN
  SELECT federation_points INTO player1_points FROM players WHERE id = NEW.player1_id;
  SELECT federation_points INTO player2_points FROM players WHERE id = NEW.player2_id;
  NEW.total_points := COALESCE(player1_points, 0) + COALESCE(player2_points, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_pair_points_before_insert_update ON pairs;
CREATE TRIGGER calculate_pair_points_before_insert_update
  BEFORE INSERT OR UPDATE ON pairs FOR EACH ROW
  EXECUTE FUNCTION calculate_pair_total_points();

CREATE OR REPLACE FUNCTION recalculate_pair_order()
RETURNS TRIGGER AS $$
BEGIN
  WITH ranked_pairs AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY total_points DESC, created_at ASC) AS new_order
    FROM pairs WHERE game_id = COALESCE(NEW.game_id, OLD.game_id)
  )
  UPDATE pairs SET pair_order = ranked_pairs.new_order
  FROM ranked_pairs WHERE pairs.id = ranked_pairs.id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recalculate_order_after_pair_change ON pairs;
CREATE TRIGGER recalculate_order_after_pair_change
  AFTER INSERT OR UPDATE OR DELETE ON pairs FOR EACH ROW
  EXECUTE FUNCTION recalculate_pair_order();

ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;
