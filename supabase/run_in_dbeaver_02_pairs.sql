-- =============================================================================
-- 2. PAIRS – Correr DEPOIS do script 01_games no DBeaver
-- Requer: tabelas public.players e public.games já existirem.
-- Se der erro "relation pairs does not exist" => corra PRIMEIRO run_in_dbeaver_01_games.sql
-- =============================================================================

-- Verificação: avisar se a tabela games não existir (obriga a correr 01 primeiro)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'games') THEN
    RAISE EXCEPTION 'A tabela "games" não existe. Corra PRIMEIRO o script run_in_dbeaver_01_games.sql e confirme que termina sem erros.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  player1_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  player2_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
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

-- Trigger updated_at
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

DROP POLICY IF EXISTS "Authenticated users can view all pairs" ON pairs;
CREATE POLICY "Authenticated users can view all pairs"
  ON pairs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Captains can insert pairs" ON pairs;
CREATE POLICY "Captains can insert pairs"
  ON pairs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')));

DROP POLICY IF EXISTS "Captains can update pairs" ON pairs;
CREATE POLICY "Captains can update pairs"
  ON pairs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')));

DROP POLICY IF EXISTS "Captains can delete pairs" ON pairs;
CREATE POLICY "Captains can delete pairs"
  ON pairs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')));
