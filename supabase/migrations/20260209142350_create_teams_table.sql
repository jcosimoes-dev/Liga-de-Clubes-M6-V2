/*
  # Criar Tabela de Equipas (Teams)

  1. Nova Tabela
    - `teams`
      - `id` (uuid, primary key)
      - `name` (text) - nome da equipa
      - `description` (text, nullable) - descrição da equipa
      - `is_active` (boolean) - equipa activa
      - `created_at` (timestamptz) - data de criação
      - `updated_at` (timestamptz) - data de actualização

  2. Segurança
    - Enable RLS na tabela `teams`
    - Apenas administradores (role='admin') podem criar/editar/apagar equipas
    - Todos os utilizadores autenticados podem ver as equipas

  3. Notas
    - Esta tabela é a base para o sistema multi-equipa
    - Cada player e game será associado a uma equipa
    - Apenas admins têm controlo total sobre equipas
*/

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_teams_is_active ON teams(is_active);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);

-- Trigger para actualizar updated_at automaticamente
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Política: Todos os utilizadores autenticados podem ver equipas
CREATE POLICY "Authenticated users can view teams"
  ON teams
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Apenas admins podem criar equipas
CREATE POLICY "Admins can insert teams"
  ON teams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Política: Apenas admins podem actualizar equipas
CREATE POLICY "Admins can update teams"
  ON teams
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Política: Apenas admins podem eliminar equipas
CREATE POLICY "Admins can delete teams"
  ON teams
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
