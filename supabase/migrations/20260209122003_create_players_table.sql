/*
  # Criar tabela de jogadores (players)

  1. Nova Tabela
    - `players`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key → auth.users) - ligação à autenticação
      - `name` (text) - nome do jogador
      - `email` (text, unique) - email do jogador
      - `phone` (text, nullable) - telemóvel opcional
      - `is_active` (boolean) - jogador activo na equipa
      - `is_captain` (boolean) - se é capitão/administrador
      - `federation_points` (integer) - pontos de federação
      - `points_updated_at` (timestamptz, nullable) - data última actualização pontos
      - `created_at` (timestamptz) - data de criação
      - `updated_at` (timestamptz) - data de actualização

  2. Segurança
    - Enable RLS na tabela `players`
    - Políticas para jogadores autenticados lerem todos os perfis
    - Políticas para jogadores lerem e actualizarem o próprio perfil
    - Políticas para capitães gerirem todos os perfis
*/

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  is_active boolean DEFAULT true NOT NULL,
  is_captain boolean DEFAULT false NOT NULL,
  federation_points integer DEFAULT 0 NOT NULL,
  points_updated_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_email ON players(email);
CREATE INDEX IF NOT EXISTS idx_players_is_active ON players(is_active);
CREATE INDEX IF NOT EXISTS idx_players_is_captain ON players(is_captain);

-- Trigger para actualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Política: Todos os jogadores autenticados podem ver todos os perfis
CREATE POLICY "Authenticated users can view all players"
  ON players
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Jogadores podem actualizar o próprio perfil
CREATE POLICY "Players can update own profile"
  ON players
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Política: Capitães podem inserir novos jogadores
CREATE POLICY "Captains can insert players"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );

-- Política: Capitães podem actualizar qualquer jogador
CREATE POLICY "Captains can update any player"
  ON players
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

-- Política: Capitães podem eliminar jogadores
CREATE POLICY "Captains can delete players"
  ON players
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );
