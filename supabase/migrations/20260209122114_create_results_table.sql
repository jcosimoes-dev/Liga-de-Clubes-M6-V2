/*
  # Criar tabela de resultados (results)

  1. Nova Tabela
    - `results`
      - `id` (uuid, primary key)
      - `game_id` (uuid, foreign key → games.id) - jogo
      - `pair_id` (uuid, foreign key → pairs.id) - dupla
      - `sets_won` (integer) - sets ganhos
      - `sets_lost` (integer) - sets perdidos
      - `notes` (text, nullable) - notas opcionais
      - `created_at` (timestamptz) - data de criação
      - `updated_at` (timestamptz) - data de actualização

  2. Segurança
    - Enable RLS na tabela `results`
    - Políticas para jogadores verem todos os resultados
    - Políticas para capitães gerirem resultados
*/

CREATE TABLE IF NOT EXISTS results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES games(id) ON DELETE CASCADE NOT NULL,
  pair_id uuid REFERENCES pairs(id) ON DELETE CASCADE NOT NULL,
  sets_won integer DEFAULT 0 NOT NULL,
  sets_lost integer DEFAULT 0 NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_results_game_id ON results(game_id);
CREATE INDEX IF NOT EXISTS idx_results_pair_id ON results(pair_id);

-- Trigger para actualizar updated_at automaticamente
CREATE TRIGGER update_results_updated_at
  BEFORE UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Política: Todos os jogadores autenticados podem ver todos os resultados
CREATE POLICY "Authenticated users can view all results"
  ON results
  FOR SELECT
  TO authenticated
  USING (true);

-- Política: Capitães podem inserir resultados
CREATE POLICY "Captains can insert results"
  ON results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );

-- Política: Capitães podem actualizar resultados
CREATE POLICY "Captains can update results"
  ON results
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

-- Política: Capitães podem eliminar resultados
CREATE POLICY "Captains can delete results"
  ON results
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND is_captain = true
    )
  );
