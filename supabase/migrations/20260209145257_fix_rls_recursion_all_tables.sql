/*
  # Corrigir Recursão RLS em Todas as Tabelas

  1. Problema
    - Funções is_admin(), is_captain() fazem SELECT na tabela players
    - Quando chamadas em policies RLS, causam recursão infinita (42P17)

  2. Solução
    - Remover TODAS as policies que usam funções recursivas
    - Remover as funções helper
    - Criar policies simples apenas para operações self-service
    - Operações administrativas via Edge Functions com service role

  3. Estrutura Final
    - players: Ver/criar/editar próprio perfil
    - games: Ver todos os jogos (sem team_id por enquanto)
    - availabilities: Ver/criar/editar próprias disponibilidades
    - pairs: Ver todos os pares
    - results: Ver todos os resultados
    - teams: Ver todas as equipas
*/

-- ============================================
-- 1. REMOVER TODAS AS POLICIES
-- ============================================

-- PLAYERS
DROP POLICY IF EXISTS "Authenticated users can view all players" ON players;
DROP POLICY IF EXISTS "Players can update own profile" ON players;
DROP POLICY IF EXISTS "Captains can insert players" ON players;
DROP POLICY IF EXISTS "Captains can update players" ON players;
DROP POLICY IF EXISTS "Captains can delete players" ON players;
DROP POLICY IF EXISTS "Users can view players" ON players;
DROP POLICY IF EXISTS "Only admins can insert players" ON players;
DROP POLICY IF EXISTS "Users can update players" ON players;
DROP POLICY IF EXISTS "Only admins can delete players" ON players;
DROP POLICY IF EXISTS "Players visibility by role" ON players;
DROP POLICY IF EXISTS "Users can create own profile or admins can create any" ON players;

-- GAMES
DROP POLICY IF EXISTS "Users can view games" ON games;
DROP POLICY IF EXISTS "Admins and captains can insert games" ON games;
DROP POLICY IF EXISTS "Admins and captains can update games" ON games;
DROP POLICY IF EXISTS "Admins and captains can delete games" ON games;

-- AVAILABILITIES
DROP POLICY IF EXISTS "Users can view availabilities" ON availabilities;
DROP POLICY IF EXISTS "Admins and captains can insert availabilities" ON availabilities;
DROP POLICY IF EXISTS "Users can update availabilities" ON availabilities;
DROP POLICY IF EXISTS "Admins and captains can delete availabilities" ON availabilities;

-- PAIRS
DROP POLICY IF EXISTS "Users can view pairs" ON pairs;
DROP POLICY IF EXISTS "Admins and captains can insert pairs" ON pairs;
DROP POLICY IF EXISTS "Admins and captains can update pairs" ON pairs;
DROP POLICY IF EXISTS "Admins and captains can delete pairs" ON pairs;

-- RESULTS
DROP POLICY IF EXISTS "Users can view results" ON results;
DROP POLICY IF EXISTS "Admins and captains can insert results" ON results;
DROP POLICY IF EXISTS "Admins and captains can update results" ON results;
DROP POLICY IF EXISTS "Admins and captains can delete results" ON results;

-- TEAMS
DROP POLICY IF EXISTS "Users can view teams" ON teams;
DROP POLICY IF EXISTS "Only admins can insert teams" ON teams;
DROP POLICY IF EXISTS "Only admins can update teams" ON teams;
DROP POLICY IF EXISTS "Only admins can delete teams" ON teams;

-- ============================================
-- 2. REMOVER FUNÇÕES HELPER RECURSIVAS
-- ============================================
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_captain() CASCADE;
DROP FUNCTION IF EXISTS is_captain_or_coordinator() CASCADE;

-- ============================================
-- 3. CRIAR POLICIES SIMPLES (NÃO-RECURSIVAS)
-- ============================================

-- PLAYERS: Ver/criar/editar próprio perfil
CREATE POLICY "Users can view own profile"
  ON players FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON players FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- GAMES: Ver todos (gestão via edge functions)
CREATE POLICY "Users can view all games"
  ON games FOR SELECT
  TO authenticated
  USING (true);

-- AVAILABILITIES: Ver/criar/editar próprias disponibilidades
CREATE POLICY "Users can view all availabilities"
  ON availabilities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own availability"
  ON availabilities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = availabilities.player_id
      AND players.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own availability"
  ON availabilities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = availabilities.player_id
      AND players.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = availabilities.player_id
      AND players.user_id = auth.uid()
    )
  );

-- PAIRS: Ver todos
CREATE POLICY "Users can view all pairs"
  ON pairs FOR SELECT
  TO authenticated
  USING (true);

-- RESULTS: Ver todos
CREATE POLICY "Users can view all results"
  ON results FOR SELECT
  TO authenticated
  USING (true);

-- TEAMS: Ver todas
CREATE POLICY "Users can view all teams"
  ON teams FOR SELECT
  TO authenticated
  USING (true);
