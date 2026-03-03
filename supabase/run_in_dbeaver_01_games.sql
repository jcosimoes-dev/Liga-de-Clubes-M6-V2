-- =============================================================================
-- 1. GAMES – Correr PRIMEIRO no DBeaver
-- Requer: tabela public.players já existir (com coluna role).
-- Nota: Políticas usam role IN ('captain','coordinator','admin') em vez de is_captain.
-- =============================================================================

-- Garantir que a função de trigger existe (usada por games e pairs)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number integer NOT NULL,
  game_date timestamptz NOT NULL,
  opponent text NOT NULL,
  location text NOT NULL,
  phase text NOT NULL,
  status text DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'convocatoria_aberta', 'convocatoria_fechada', 'concluido', 'cancelado')),
  created_by uuid REFERENCES players(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_game_date ON games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_created_by ON games(created_by);
CREATE INDEX IF NOT EXISTS idx_games_round_number ON games(round_number);

-- Trigger updated_at (requer que a função update_updated_at_column já exista, ex.: da migração de players)
DROP TRIGGER IF EXISTS update_games_updated_at ON games;
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Políticas: cada DROP corre antes do CREATE (executar o script INTEIRO, não só as linhas abaixo)
DROP POLICY IF EXISTS "Authenticated users can view all games" ON games;
CREATE POLICY "Authenticated users can view all games"
  ON games FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Captains can insert games" ON games;
CREATE POLICY "Captains can insert games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin'))
  );

DROP POLICY IF EXISTS "Captains can update games" ON games;
CREATE POLICY "Captains can update games"
  ON games FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')));

DROP POLICY IF EXISTS "Captains can delete games" ON games;
CREATE POLICY "Captains can delete games"
  ON games FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')));
