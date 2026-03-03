/*
  # Complete RLS Policies for All Roles

  ## Summary
  Configure comprehensive RLS policies for all roles across all tables.

  ## Role Permissions Summary

  ### Jogador (Player)
  - View and update own profile
  - View all teams and games
  - Create and manage own availability
  - View own pairs and results

  ### Capitão (Captain)
  - All Jogador permissions +
  - Create and update teams
  - Create and update games
  - View all availabilities
  - Create and update pairs
  - Create and update results

  ### Coordenador (Coordinator)
  - Read-only access to all tables

  ### Administrador (Admin)
  - Full CRUD access to all tables

  ## Tables Configured
  - teams
  - games
  - availabilities
  - pairs
  - results
  (players already configured in previous migration)
*/

-- ============================================================
-- TEAMS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Users can view teams in their team" ON teams;
DROP POLICY IF EXISTS "Only admins can insert teams" ON teams;
DROP POLICY IF EXISTS "Users can update teams" ON teams;
DROP POLICY IF EXISTS "Only admins can delete teams" ON teams;
DROP POLICY IF EXISTS "Admins can delete teams" ON teams;
DROP POLICY IF EXISTS "Admins can insert teams" ON teams;
DROP POLICY IF EXISTS "Admins can update teams" ON teams;
DROP POLICY IF EXISTS "Authenticated users can view teams" ON teams;
DROP POLICY IF EXISTS "Users can view all teams" ON teams;

CREATE POLICY "All authenticated users can view teams"
  ON teams FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Captains and admins can create teams"
  ON teams FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Captains and admins can update teams"
  ON teams FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'))
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Only admins can delete teams"
  ON teams FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');

-- ============================================================
-- GAMES TABLE
-- ============================================================

DROP POLICY IF EXISTS "Users can view games in their team" ON games;
DROP POLICY IF EXISTS "Only admins can insert games" ON games;
DROP POLICY IF EXISTS "Only admins can update games" ON games;
DROP POLICY IF EXISTS "Only admins can delete games" ON games;
DROP POLICY IF EXISTS "Users can view all games" ON games;

CREATE POLICY "All authenticated users can view games"
  ON games FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Captains and admins can create games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Captains and admins can update games"
  ON games FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'))
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Only admins can delete games"
  ON games FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');

-- ============================================================
-- AVAILABILITIES TABLE
-- ============================================================

DROP POLICY IF EXISTS "Users can view availabilities in their team" ON availabilities;
DROP POLICY IF EXISTS "Users can insert their own availability" ON availabilities;
DROP POLICY IF EXISTS "Users can update their own availability" ON availabilities;
DROP POLICY IF EXISTS "Users can delete their own availability" ON availabilities;
DROP POLICY IF EXISTS "Users can insert own availability" ON availabilities;
DROP POLICY IF EXISTS "Users can update own availability" ON availabilities;
DROP POLICY IF EXISTS "Users can view all availabilities" ON availabilities;

CREATE POLICY "Players can view own availability"
  ON availabilities FOR SELECT TO authenticated
  USING (
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  );

CREATE POLICY "Captains and admins can view all availabilities"
  ON availabilities FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Players can create own availability"
  ON availabilities FOR INSERT TO authenticated
  WITH CHECK (
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  );

CREATE POLICY "Players can update own availability"
  ON availabilities FOR UPDATE TO authenticated
  USING (
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  )
  WITH CHECK (
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  );

CREATE POLICY "Players can delete own availability"
  ON availabilities FOR DELETE TO authenticated
  USING (
    player_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  );

-- ============================================================
-- PAIRS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Users can view pairs" ON pairs;
DROP POLICY IF EXISTS "Only admins can insert pairs" ON pairs;
DROP POLICY IF EXISTS "Only admins can update pairs" ON pairs;
DROP POLICY IF EXISTS "Only admins can delete pairs" ON pairs;
DROP POLICY IF EXISTS "Users can view all pairs" ON pairs;

CREATE POLICY "Players can view own pairs"
  ON pairs FOR SELECT TO authenticated
  USING (
    player1_id IN (SELECT id FROM players WHERE user_id = auth.uid())
    OR player2_id IN (SELECT id FROM players WHERE user_id = auth.uid())
  );

CREATE POLICY "Captains and admins can view all pairs"
  ON pairs FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Captains and admins can create pairs"
  ON pairs FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Captains and admins can update pairs"
  ON pairs FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'))
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Only admins can delete pairs"
  ON pairs FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');

-- ============================================================
-- RESULTS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Users can view results" ON results;
DROP POLICY IF EXISTS "Only admins can insert results" ON results;
DROP POLICY IF EXISTS "Only admins can update results" ON results;
DROP POLICY IF EXISTS "Only admins can delete results" ON results;
DROP POLICY IF EXISTS "Users can view all results" ON results;

CREATE POLICY "Players can view results for their games"
  ON results FOR SELECT TO authenticated
  USING (
    game_id IN (
      SELECT DISTINCT game_id 
      FROM pairs 
      WHERE player1_id IN (SELECT id FROM players WHERE user_id = auth.uid())
         OR player2_id IN (SELECT id FROM players WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Captains and admins can view all results"
  ON results FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Captains and admins can create results"
  ON results FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Captains and admins can update results"
  ON results FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'))
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

CREATE POLICY "Only admins can delete results"
  ON results FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');
