/*
  # Criar tabela de jogos (games)

  1. Nova Tabela
    - `games`
      - `id` (uuid, primary key)
      - `round_number` (integer) - número da jornada
      - `game_date` (timestamptz) - data e hora do jogo
      - `opponent` (text) - adversário
      - `location` (text) - local do jogo
      - `phase` (text) - fase (Regular, Playoff, Final, etc)
      - `status` (text) - estado: draft, convocatoria_aberta, convocatoria_fechada, concluido, cancelado
      - `created_by` (uuid, foreign key → players.id) - capitão que criou o jogo
      - `created_at` (timestamptz) - data de criação
      - `updated_at` (timestamptz) - data de actualização

  2. Segurança
    - Enable RLS na tabela `games`
    - Políticas para jogadores autenticados verem todos os jogos
    - Políticas para capitães criarem e gerirem jogos
*/

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

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_game_date ON games(game_date);
CREATE INDEX IF NOT EXISTS idx_games_created_by ON games(created_by);
CREATE INDEX IF NOT EXISTS idx_games_round_number ON games(round_number);

-- Trigger para actualizar updated_at automaticamente
CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

-- Política: Todos os jogadores autenticados podem ver todos os jogos
CREATE POLICY "Authenticated users can view all games"
  ON games
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Capitães podem criar jogos
CREATE POLICY "Captains can insert games"
  ON games
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );

-- Política: Capitães podem actualizar jogos
CREATE POLICY "Captains can update games"
  ON games
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

-- Política: Capitães podem eliminar jogos
CREATE POLICY "Captains can delete games"
  ON games
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );
