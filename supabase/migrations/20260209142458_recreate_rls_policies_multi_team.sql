/*
  # Recriar Políticas RLS com Lógica Multi-Equipa

  1. Hierarquia de Roles
    - admin: acesso total a todas as equipas e utilizadores
    - capitao: operações da equipa (criar/editar jogos, fechar convocatória, definir duplas, registar resultados)
    - coordenador: apenas leitura + supervisão da sua equipa
    - jogador: ver jogos, responder disponibilidade, ver duplas/resultados da sua equipa

  2. Regras de Acesso
    - Admins não têm team_id (acesso global)
    - Capitães, coordenadores e jogadores apenas acedem dados da sua equipa
    - Coordenadores só têm SELECT (sem INSERT/UPDATE/DELETE)

  3. Políticas Aplicadas
    - players: admins gerem todos, outros apenas vêem da sua equipa
    - games: admins e capitães gerem, coordenadores e jogadores vêem
    - availabilities: todos vêem da sua equipa, jogadores actualizam a própria
    - pairs: admins e capitães gerem, todos vêem
    - results: admins e capitães gerem, todos vêem
*/

-- ============================================
-- HELPER FUNCTION: Verificar se utilizador é admin
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM players
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Obter team_id do utilizador
-- ============================================
CREATE OR REPLACE FUNCTION get_user_team_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT team_id FROM players
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Verificar se é capitão da equipa
-- ============================================
CREATE OR REPLACE FUNCTION is_team_captain(check_team_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM players
    WHERE user_id = auth.uid()
    AND role = 'capitao'
    AND team_id = check_team_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TABELA: players
-- ============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can view all players" ON players;
DROP POLICY IF EXISTS "Players can update own profile" ON players;
DROP POLICY IF EXISTS "Admins can insert players" ON players;
DROP POLICY IF EXISTS "Admins can update any player" ON players;
DROP POLICY IF EXISTS "Admins can delete players" ON players;

-- SELECT: Admins vêem todos, outros vêem apenas da sua equipa
CREATE POLICY "Users can view players"
  ON players
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR team_id = get_user_team_id()
  );

-- INSERT: Apenas admins podem criar utilizadores
CREATE POLICY "Only admins can insert players"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- UPDATE: Jogadores podem actualizar próprio perfil (pontos), admins podem actualizar qualquer um
CREATE POLICY "Users can update players"
  ON players
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR 
    auth.uid() = user_id
  )
  WITH CHECK (
    is_admin() OR 
    auth.uid() = user_id
  );

-- DELETE: Apenas admins podem eliminar utilizadores
CREATE POLICY "Only admins can delete players"
  ON players
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================
-- TABELA: games
-- ============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can view all games" ON games;
DROP POLICY IF EXISTS "Admins can insert games" ON games;
DROP POLICY IF EXISTS "Admins can update games" ON games;
DROP POLICY IF EXISTS "Admins can delete games" ON games;

-- SELECT: Admins vêem todos, outros vêem apenas da sua equipa
CREATE POLICY "Users can view games"
  ON games
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR team_id = get_user_team_id()
  );

-- INSERT: Admins e capitães podem criar jogos
CREATE POLICY "Admins and captains can insert games"
  ON games
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR 
    (is_team_captain(team_id) AND team_id = get_user_team_id())
  );

-- UPDATE: Admins e capitães podem actualizar jogos
CREATE POLICY "Admins and captains can update games"
  ON games
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR 
    (is_team_captain(team_id) AND team_id = get_user_team_id())
  )
  WITH CHECK (
    is_admin() OR 
    (is_team_captain(team_id) AND team_id = get_user_team_id())
  );

-- DELETE: Admins e capitães podem eliminar jogos
CREATE POLICY "Admins and captains can delete games"
  ON games
  FOR DELETE
  TO authenticated
  USING (
    is_admin() OR 
    (is_team_captain(team_id) AND team_id = get_user_team_id())
  );

-- ============================================
-- TABELA: availabilities
-- ============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can view all availabilities" ON availabilities;
DROP POLICY IF EXISTS "Players can update own availability" ON availabilities;
DROP POLICY IF EXISTS "Admins can insert availabilities" ON availabilities;
DROP POLICY IF EXISTS "Admins can update any availability" ON availabilities;
DROP POLICY IF EXISTS "Admins can delete availabilities" ON availabilities;

-- SELECT: Todos vêem availabilities dos jogos da sua equipa
CREATE POLICY "Users can view availabilities"
  ON availabilities
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = availabilities.game_id
      AND games.team_id = get_user_team_id()
    )
  );

-- INSERT: Admins e capitães podem criar availabilities
CREATE POLICY "Admins and captains can insert availabilities"
  ON availabilities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = availabilities.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  );

-- UPDATE: Jogadores podem actualizar a própria availability, admins e capitães podem actualizar qualquer uma
CREATE POLICY "Users can update availabilities"
  ON availabilities
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR 
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = availabilities.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  )
  WITH CHECK (
    is_admin() OR 
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = availabilities.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  );

-- DELETE: Admins e capitães podem eliminar availabilities
CREATE POLICY "Admins and captains can delete availabilities"
  ON availabilities
  FOR DELETE
  TO authenticated
  USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = availabilities.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  );

-- ============================================
-- TABELA: pairs
-- ============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can view all pairs" ON pairs;
DROP POLICY IF EXISTS "Admins can insert pairs" ON pairs;
DROP POLICY IF EXISTS "Admins can update pairs" ON pairs;
DROP POLICY IF EXISTS "Admins can delete pairs" ON pairs;

-- SELECT: Todos vêem pairs dos jogos da sua equipa
CREATE POLICY "Users can view pairs"
  ON pairs
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = pairs.game_id
      AND games.team_id = get_user_team_id()
    )
  );

-- INSERT: Admins e capitães podem criar pairs
CREATE POLICY "Admins and captains can insert pairs"
  ON pairs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = pairs.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  );

-- UPDATE: Admins e capitães podem actualizar pairs
CREATE POLICY "Admins and captains can update pairs"
  ON pairs
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = pairs.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  )
  WITH CHECK (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = pairs.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  );

-- DELETE: Admins e capitães podem eliminar pairs
CREATE POLICY "Admins and captains can delete pairs"
  ON pairs
  FOR DELETE
  TO authenticated
  USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = pairs.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  );

-- ============================================
-- TABELA: results
-- ============================================

-- Remover políticas antigas
DROP POLICY IF EXISTS "Authenticated users can view all results" ON results;
DROP POLICY IF EXISTS "Admins can insert results" ON results;
DROP POLICY IF EXISTS "Admins can update results" ON results;
DROP POLICY IF EXISTS "Admins can delete results" ON results;

-- SELECT: Todos vêem results dos jogos da sua equipa
CREATE POLICY "Users can view results"
  ON results
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      WHERE games.id = results.game_id
      AND games.team_id = get_user_team_id()
    )
  );

-- INSERT: Admins e capitães podem criar results
CREATE POLICY "Admins and captains can insert results"
  ON results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = results.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  );

-- UPDATE: Admins e capitães podem actualizar results
CREATE POLICY "Admins and captains can update results"
  ON results
  FOR UPDATE
  TO authenticated
  USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = results.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  )
  WITH CHECK (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = results.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  );

-- DELETE: Admins e capitães podem eliminar results
CREATE POLICY "Admins and captains can delete results"
  ON results
  FOR DELETE
  TO authenticated
  USING (
    is_admin() OR 
    EXISTS (
      SELECT 1 FROM games
      JOIN players ON players.user_id = auth.uid()
      WHERE games.id = results.game_id
      AND games.team_id = players.team_id
      AND players.role = 'capitao'
    )
  );
