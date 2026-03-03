/*
  # Criar tabela de duplas (pairs)

  1. Nova Tabela
    - `pairs`
      - `id` (uuid, primary key)
      - `game_id` (uuid, foreign key → games.id) - jogo
      - `player1_id` (uuid, foreign key → players.id) - jogador 1
      - `player2_id` (uuid, foreign key → players.id) - jogador 2
      - `total_points` (integer) - soma dos pontos de federação (calculado automaticamente)
      - `pair_order` (integer) - ordem da dupla (1, 2, 3...) calculado automaticamente
      - `created_at` (timestamptz) - data de criação
      - `updated_at` (timestamptz) - data de actualização

  2. Funcionalidades
    - Trigger para calcular automaticamente total_points (soma federation_points dos 2 jogadores)
    - Trigger para recalcular pair_order de todas as duplas do jogo (ordem decrescente por total_points)

  3. Segurança
    - Enable RLS na tabela `pairs`
    - Políticas para jogadores verem todas as duplas
    - Políticas para capitães gerirem duplas
*/

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

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_pairs_game_id ON pairs(game_id);
CREATE INDEX IF NOT EXISTS idx_pairs_player1_id ON pairs(player1_id);
CREATE INDEX IF NOT EXISTS idx_pairs_player2_id ON pairs(player2_id);
CREATE INDEX IF NOT EXISTS idx_pairs_pair_order ON pairs(pair_order);

-- Trigger para actualizar updated_at automaticamente
CREATE TRIGGER update_pairs_updated_at
  BEFORE UPDATE ON pairs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular total_points automaticamente
CREATE OR REPLACE FUNCTION calculate_pair_total_points()
RETURNS TRIGGER AS $$
DECLARE
  player1_points integer;
  player2_points integer;
BEGIN
  -- Buscar pontos dos dois jogadores
  SELECT federation_points INTO player1_points
  FROM players
  WHERE id = NEW.player1_id;
  
  SELECT federation_points INTO player2_points
  FROM players
  WHERE id = NEW.player2_id;
  
  -- Calcular soma
  NEW.total_points := COALESCE(player1_points, 0) + COALESCE(player2_points, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular total_points antes de inserir ou actualizar
CREATE TRIGGER calculate_pair_points_before_insert_update
  BEFORE INSERT OR UPDATE ON pairs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_pair_total_points();

-- Função para recalcular pair_order de todas as duplas de um jogo
CREATE OR REPLACE FUNCTION recalculate_pair_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalcular ordem de todas as duplas do jogo
  WITH ranked_pairs AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY total_points DESC, created_at ASC) as new_order
    FROM pairs
    WHERE game_id = COALESCE(NEW.game_id, OLD.game_id)
  )
  UPDATE pairs
  SET pair_order = ranked_pairs.new_order
  FROM ranked_pairs
  WHERE pairs.id = ranked_pairs.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para recalcular order após inserir, actualizar ou eliminar dupla
CREATE TRIGGER recalculate_order_after_pair_change
  AFTER INSERT OR UPDATE OR DELETE ON pairs
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_pair_order();

-- Enable RLS
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;

-- Política: Todos os jogadores autenticados podem ver todas as duplas
CREATE POLICY "Authenticated users can view all pairs"
  ON pairs
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Capitães podem inserir duplas
CREATE POLICY "Captains can insert pairs"
  ON pairs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );

-- Política: Capitães podem actualizar duplas
CREATE POLICY "Captains can update pairs"
  ON pairs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );

-- Política: Capitães podem eliminar duplas
CREATE POLICY "Captains can delete pairs"
  ON pairs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );
