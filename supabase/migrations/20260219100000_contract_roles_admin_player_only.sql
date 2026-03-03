/*
  # Contrato fechado: apenas admin e player

  1. Normalização: migrar todos os valores legacy para admin ou player
     - jogador, capitao, coordenador, captain, coordinator -> player
     - admin, administrador -> admin

  2. Constraint: players.role IN ('admin','player')
  3. Trigger e RLS: apenas admin tem permissões de gestão
*/

-- ============================================================
-- 1. NORMALIZAÇÃO
-- ============================================================

UPDATE players SET role = 'player' WHERE role IN ('jogador', 'capitao', 'coordenador', 'captain', 'coordinator');
UPDATE players SET role = 'admin' WHERE LOWER(role) = 'administrador';
-- admin já está correto

-- ============================================================
-- 2. CONSTRAINT players.role
-- ============================================================

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_role_check;
ALTER TABLE players ADD CONSTRAINT players_role_check
  CHECK (role IN ('admin', 'player'));

-- ============================================================
-- 3. DEFAULT
-- ============================================================

ALTER TABLE players ALTER COLUMN role SET DEFAULT 'player';

-- ============================================================
-- 4. Trigger: availabilities para players (não admins)
-- ============================================================

CREATE OR REPLACE FUNCTION create_availabilities_for_new_game()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO availabilities (game_id, player_id, status)
  SELECT NEW.id, id, 'sem_resposta'
  FROM players
  WHERE is_active = true
  AND role = 'player'
  AND team_id = NEW.team_id;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5. RLS: apenas admin (remover captain)
-- ============================================================

-- games
DROP POLICY IF EXISTS "Captains and admins can create games" ON games;
DROP POLICY IF EXISTS "Captains and admins can update games" ON games;
CREATE POLICY "Admins can create games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');
CREATE POLICY "Admins can update games"
  ON games FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- availabilities
DROP POLICY IF EXISTS "Admins and captains can update all availabilities" ON availabilities;
DROP POLICY IF EXISTS "Captains and admins can view all availabilities" ON availabilities;
CREATE POLICY "Admins can update all availabilities"
  ON availabilities FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');
CREATE POLICY "Admins can view all availabilities"
  ON availabilities FOR SELECT TO authenticated
  USING (get_current_user_role() = 'admin');

-- pairs
DROP POLICY IF EXISTS "Captains and admins can delete pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can view all pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can create pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can update pairs" ON pairs;
CREATE POLICY "Admins can delete pairs"
  ON pairs FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');
CREATE POLICY "Admins can view all pairs"
  ON pairs FOR SELECT TO authenticated
  USING (get_current_user_role() = 'admin');
CREATE POLICY "Admins can create pairs"
  ON pairs FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');
CREATE POLICY "Admins can update pairs"
  ON pairs FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');

-- results
DROP POLICY IF EXISTS "Captains and admins can view all results" ON results;
DROP POLICY IF EXISTS "Captains and admins can create results" ON results;
DROP POLICY IF EXISTS "Captains and admins can update results" ON results;
CREATE POLICY "Admins can view all results"
  ON results FOR SELECT TO authenticated
  USING (get_current_user_role() = 'admin');
CREATE POLICY "Admins can create results"
  ON results FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');
CREATE POLICY "Admins can update results"
  ON results FOR UPDATE TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');
