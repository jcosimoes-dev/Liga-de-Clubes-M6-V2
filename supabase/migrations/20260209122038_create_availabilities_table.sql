/*
  # Criar tabela de disponibilidades (availabilities)

  1. Nova Tabela
    - `availabilities`
      - `id` (uuid, primary key)
      - `game_id` (uuid, foreign key → games.id) - jogo
      - `player_id` (uuid, foreign key → players.id) - jogador
      - `status` (text) - estado: sem_resposta, confirmo, nao_posso, talvez
      - `created_at` (timestamptz) - data de criação
      - `updated_at` (timestamptz) - data de actualização
      - CONSTRAINT: UNIQUE(game_id, player_id) - um jogador só tem uma disponibilidade por jogo

  2. Funcionalidades
    - Trigger para criar automaticamente availabilities para todos jogadores activos quando jogo é criado
    - Estado inicial: sem_resposta

  3. Segurança
    - Enable RLS na tabela `availabilities`
    - Políticas para jogadores verem disponibilidades de todos
    - Políticas para jogadores actualizarem a própria disponibilidade
    - Políticas para capitães gerirem todas as disponibilidades
*/

CREATE TABLE IF NOT EXISTS availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'sem_resposta' NOT NULL CHECK (status IN ('sem_resposta', 'confirmo', 'nao_posso', 'talvez')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(game_id, player_id)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_availabilities_game_id ON availabilities(game_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_player_id ON availabilities(player_id);
CREATE INDEX IF NOT EXISTS idx_availabilities_status ON availabilities(status);

-- Trigger para actualizar updated_at automaticamente
CREATE TRIGGER update_availabilities_updated_at
  BEFORE UPDATE ON availabilities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para criar automaticamente availabilities quando um jogo é criado
CREATE OR REPLACE FUNCTION create_availabilities_for_new_game()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar availability para todos os jogadores activos
  INSERT INTO availabilities (game_id, player_id, status)
  SELECT NEW.id, id, 'sem_resposta'
  FROM players
  WHERE is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que executa após criar um jogo
CREATE TRIGGER create_availabilities_on_game_insert
  AFTER INSERT ON games
  FOR EACH ROW
  EXECUTE FUNCTION create_availabilities_for_new_game();

-- Enable RLS
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;

-- Política: Todos os jogadores autenticados podem ver todas as disponibilidades
CREATE POLICY "Authenticated users can view all availabilities"
  ON availabilities
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Jogadores podem actualizar a própria disponibilidade
CREATE POLICY "Players can update own availability"
  ON availabilities
  FOR UPDATE
  TO authenticated
  USING (
    player_id IN (
      SELECT id FROM players WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    player_id IN (
      SELECT id FROM players WHERE user_id = auth.uid()
    )
  );

-- Política: Capitães podem inserir disponibilidades
CREATE POLICY "Captains can insert availabilities"
  ON availabilities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );

-- Política: Capitães podem actualizar qualquer disponibilidade
CREATE POLICY "Captains can update any availability"
  ON availabilities
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

-- Política: Capitães podem eliminar disponibilidades
CREATE POLICY "Captains can delete availabilities"
  ON availabilities
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );
