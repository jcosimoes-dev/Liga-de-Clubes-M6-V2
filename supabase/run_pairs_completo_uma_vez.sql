-- =============================================================================
-- PAIRS – Script ÚNICO: tabela + triggers + políticas (Supabase ou DBeaver)
-- Correr UMA vez. Requer: tabelas public.players e public.games já existirem.
-- Se der "relation games does not exist" => criar primeiro a tabela games (script 01).
-- =============================================================================

-- 1. Função para o trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Verificar que games e players existem (evita erro confuso)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'games') THEN
    RAISE EXCEPTION 'Crie primeiro a tabela games (run_in_dbeaver_01_games.sql).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'players') THEN
    RAISE EXCEPTION 'A tabela players não existe neste projeto.';
  END IF;
END $$;

-- 3. Tabela pairs
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

-- 4. Trigger updated_at
DROP TRIGGER IF EXISTS update_pairs_updated_at ON pairs;
CREATE TRIGGER update_pairs_updated_at
  BEFORE UPDATE ON pairs FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Função e trigger total_points
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

-- 6. Função e trigger pair_order
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

-- 7. RLS
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;

-- 8. Políticas
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
