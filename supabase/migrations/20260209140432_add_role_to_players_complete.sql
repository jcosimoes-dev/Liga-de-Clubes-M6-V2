/*
  # Adicionar Role aos Players - Migração Completa

  1. Mudanças na Tabela players
    - Adicionar coluna `role` (text) com valores: 'jogador', 'capitao', 'coordenador'
    - Default: 'jogador'
    - Migrar valores de `is_captain` para `role`
    - Remover coluna `is_captain` após migração
    - Adicionar constraint CHECK para validar apenas os 3 roles válidos

  2. Políticas RLS
    - Remover TODAS as políticas que dependem de `is_captain` em todas as tabelas
    - Recriar políticas usando `role IN ('capitao', 'coordenador')` para permissões administrativas
    - Capitães e Coordenadores têm as mesmas permissões administrativas

  3. Índices
    - Remover índice `idx_players_is_captain`
    - Adicionar índice `idx_players_role`

  4. Tabelas Afetadas
    - players
    - games
    - availabilities
    - pairs
    - results

  5. Notas
    - Coordenadores NÃO jogam mas têm permissões administrativas
    - Jogadores existentes são migrados automaticamente
*/

-- ============================================
-- PASSO 1: Remover todas as políticas que dependem de is_captain
-- ============================================

-- Políticas da tabela players
DROP POLICY IF EXISTS "Captains can insert players" ON players;
DROP POLICY IF EXISTS "Captains can update any player" ON players;
DROP POLICY IF EXISTS "Captains can delete players" ON players;

-- Políticas da tabela games
DROP POLICY IF EXISTS "Captains can insert games" ON games;
DROP POLICY IF EXISTS "Captains can update games" ON games;
DROP POLICY IF EXISTS "Captains can delete games" ON games;

-- Políticas da tabela availabilities
DROP POLICY IF EXISTS "Captains can insert availabilities" ON availabilities;
DROP POLICY IF EXISTS "Captains can update any availability" ON availabilities;
DROP POLICY IF EXISTS "Captains can delete availabilities" ON availabilities;

-- Políticas da tabela pairs
DROP POLICY IF EXISTS "Captains can insert pairs" ON pairs;
DROP POLICY IF EXISTS "Captains can update pairs" ON pairs;
DROP POLICY IF EXISTS "Captains can delete pairs" ON pairs;

-- Políticas da tabela results
DROP POLICY IF EXISTS "Captains can insert results" ON results;
DROP POLICY IF EXISTS "Captains can update results" ON results;
DROP POLICY IF EXISTS "Captains can delete results" ON results;

-- ============================================
-- PASSO 2: Adicionar coluna role e migrar dados
-- ============================================

-- Adicionar coluna role (temporariamente nullable)
ALTER TABLE players
ADD COLUMN IF NOT EXISTS role text;

-- Migrar is_captain para role
UPDATE players
SET role = CASE
  WHEN is_captain = true THEN 'capitao'
  ELSE 'jogador'
END
WHERE role IS NULL;

-- Tornar role NOT NULL e adicionar default
ALTER TABLE players
ALTER COLUMN role SET NOT NULL,
ALTER COLUMN role SET DEFAULT 'jogador';

-- Adicionar constraint CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'players_role_check'
  ) THEN
    ALTER TABLE players
    ADD CONSTRAINT players_role_check
    CHECK (role IN ('jogador', 'capitao', 'coordenador'));
  END IF;
END $$;

-- ============================================
-- PASSO 3: Remover is_captain e atualizar índices
-- ============================================

-- Remover coluna is_captain
ALTER TABLE players
DROP COLUMN IF EXISTS is_captain;

-- Atualizar índices
DROP INDEX IF EXISTS idx_players_is_captain;
CREATE INDEX IF NOT EXISTS idx_players_role ON players(role);

-- ============================================
-- PASSO 4: Recriar políticas usando role
-- ============================================

-- TABELA: players
-- Política: Administradores (capitães e coordenadores) podem inserir jogadores
CREATE POLICY "Admins can insert players"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem actualizar qualquer jogador
CREATE POLICY "Admins can update any player"
  ON players
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem eliminar jogadores
CREATE POLICY "Admins can delete players"
  ON players
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- TABELA: games
-- Política: Administradores podem criar jogos
CREATE POLICY "Admins can insert games"
  ON games
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem actualizar jogos
CREATE POLICY "Admins can update games"
  ON games
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem eliminar jogos
CREATE POLICY "Admins can delete games"
  ON games
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- TABELA: availabilities
-- Política: Administradores podem inserir disponibilidades
CREATE POLICY "Admins can insert availabilities"
  ON availabilities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem actualizar qualquer disponibilidade
CREATE POLICY "Admins can update any availability"
  ON availabilities
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem eliminar disponibilidades
CREATE POLICY "Admins can delete availabilities"
  ON availabilities
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- TABELA: pairs
-- Política: Administradores podem inserir duplas
CREATE POLICY "Admins can insert pairs"
  ON pairs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem actualizar duplas
CREATE POLICY "Admins can update pairs"
  ON pairs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem eliminar duplas
CREATE POLICY "Admins can delete pairs"
  ON pairs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- TABELA: results
-- Política: Administradores podem inserir resultados
CREATE POLICY "Admins can insert results"
  ON results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem actualizar resultados
CREATE POLICY "Admins can update results"
  ON results
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );

-- Política: Administradores podem eliminar resultados
CREATE POLICY "Admins can delete results"
  ON results
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE user_id = auth.uid()
      AND role IN ('capitao', 'coordenador')
    )
  );
