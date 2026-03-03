/*
  # Contrato fechado: roles em inglês (admin, coordinator, captain, player)

  1. Normalização: migrar dados existentes de PT para EN
     - jogador → player
     - capitao → captain
     - coordenador → coordinator
     - admin → admin (inalterado)

  2. Constraints: players.role IN ('admin','coordinator','captain','player')
     players.preferred_side IN ('left','right','both') se existir coluna

  3. Atualizar triggers e políticas RLS para usar os novos valores
*/

-- ============================================================
-- 1. NORMALIZAÇÃO (antes de aplicar constraints)
-- ============================================================

UPDATE players SET role = 'player' WHERE role = 'jogador';
UPDATE players SET role = 'captain' WHERE role = 'capitao';
UPDATE players SET role = 'coordinator' WHERE role = 'coordenador';
-- admin permanece admin

-- ============================================================
-- 2. CONSTRAINT players.role
-- ============================================================

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_role_check;
ALTER TABLE players ADD CONSTRAINT players_role_check
  CHECK (role IN ('admin', 'coordinator', 'captain', 'player'));

-- ============================================================
-- 3. CONSTRAINT players.preferred_side (se coluna existir)
-- ============================================================

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_preferred_side_check;
ALTER TABLE players ADD CONSTRAINT players_preferred_side_check
  CHECK (preferred_side IN ('left', 'right', 'both'));

-- ============================================================
-- 4. Atualizar players_team_id_required_for_non_admin
-- ============================================================

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_team_id_required_for_non_admin;
ALTER TABLE players ADD CONSTRAINT players_team_id_required_for_non_admin
  CHECK ((role = 'admin') OR (role != 'admin' AND team_id IS NOT NULL));

-- ============================================================
-- 5. Trigger create_availabilities_for_new_game
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
  AND role IN ('player', 'captain')
  AND team_id = NEW.team_id;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 5b. DEFAULT para novos inserts
-- ============================================================

ALTER TABLE players ALTER COLUMN role SET DEFAULT 'player';

-- ============================================================
-- 6. Políticas RLS (capitao→captain, jogador→player, coordenador→coordinator)
-- ============================================================

-- games (capitao, admin -> captain, admin)
DROP POLICY IF EXISTS "Captains and admins can create games" ON games;
DROP POLICY IF EXISTS "Captains and admins can update games" ON games;
CREATE POLICY "Captains and admins can create games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));
CREATE POLICY "Captains and admins can update games"
  ON games FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'))
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

-- availabilities (política de admins/captains atualizar)
DROP POLICY IF EXISTS "Admins and captains can update all availabilities" ON availabilities;
CREATE POLICY "Admins and captains can update all availabilities"
  ON availabilities FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'))
  WITH CHECK (get_current_user_role() IN ('captain', 'admin'));

-- availabilities (view)
DROP POLICY IF EXISTS "Captains and admins can view all availabilities" ON availabilities;
CREATE POLICY "Captains and admins can view all availabilities"
  ON availabilities FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'));

-- pairs (delete)
DROP POLICY IF EXISTS "Captains and admins can delete pairs" ON pairs;
CREATE POLICY "Captains and admins can delete pairs"
  ON pairs FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'));

-- pairs (view, create, update)
DROP POLICY IF EXISTS "Captains and admins can view all pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can create pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can update pairs" ON pairs;
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

-- results
DROP POLICY IF EXISTS "Captains and admins can view all results" ON results;
DROP POLICY IF EXISTS "Captains and admins can create results" ON results;
DROP POLICY IF EXISTS "Captains and admins can update results" ON results;
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
