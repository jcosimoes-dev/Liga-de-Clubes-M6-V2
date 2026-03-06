/*
  # Revisão de Permissões (Roles) — admin, gestor, coordenador, capitao, jogador

  Regras:
  - Admin e Gestor: TUDO (Criar, Editar, Apagar) em games, players, results.
  - Coordenador: Criar e Editar jogos e resultados; NÃO pode apagar jogadores.
  - Capitão: Apenas submeter resultados dos jogos da sua equipa.
  - Jogador: Apenas LEITURA (ver jogos e classificações).

  1. Constraint players.role: admin, gestor, coordenador, capitao, jogador
  2. Migrar 'player' -> 'jogador' (admin mantém-se)
  3. Helper is_admin_or_gestor_bypass() para políticas em players (evitar recursão RLS)
  4. Políticas RLS em players, games, results
*/

-- ============================================================
-- 1. NORMALIZAÇÃO DE DADOS (legacy -> novos roles)
-- ============================================================

UPDATE players SET role = 'jogador' WHERE role IN ('player', 'jogador');
UPDATE players SET role = 'capitao' WHERE role IN ('captain', 'capitao');
UPDATE players SET role = 'coordenador' WHERE role IN ('coordinator', 'coordenador');
-- admin e gestor mantêm-se; quem já é admin continua admin

-- ============================================================
-- 2. CONSTRAINT players.role
-- ============================================================

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_role_check;
ALTER TABLE players ADD CONSTRAINT players_role_check
  CHECK (role IN ('admin', 'gestor', 'coordenador', 'capitao', 'jogador'));

-- ============================================================
-- 3. CONSTRAINT team_id (admin e gestor podem ter team_id nulo)
-- ============================================================

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_team_id_required_for_non_admin;
ALTER TABLE players ADD CONSTRAINT players_team_id_required_for_non_admin
  CHECK (
    (role IN ('admin', 'gestor'))
    OR (role IN ('coordenador', 'capitao', 'jogador') AND team_id IS NOT NULL)
  );

ALTER TABLE players ALTER COLUMN role SET DEFAULT 'jogador';

-- ============================================================
-- 4. HELPER: is_admin_or_gestor_bypass (para políticas em players, evita recursão)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_gestor_bypass()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gestor')
  );
$$;

-- Manter is_admin_bypass a retornar true para admin OU gestor (compatibilidade)
CREATE OR REPLACE FUNCTION public.is_admin_bypass()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT is_admin_or_gestor_bypass();
$$;

-- is_user_admin() usado por RPCs (ex.: get_team_players_for_admin): admin ou gestor
CREATE OR REPLACE FUNCTION public.is_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'gestor')
  );
$$;

-- ============================================================
-- 5. PLAYERS — Políticas RLS
-- ============================================================

-- SELECT: todos os autenticados podem ver todos os jogadores
DROP POLICY IF EXISTS "All authenticated users can view all players" ON players;
CREATE POLICY "All authenticated users can view all players"
  ON players FOR SELECT TO authenticated
  USING (true);

-- INSERT: próprio perfil (user_id = auth.uid()) OU admin/gestor
DROP POLICY IF EXISTS "Bootstrap: allow first profile creation" ON players;
DROP POLICY IF EXISTS "Bootstrap: users can insert profile when no admin exists" ON players;
DROP POLICY IF EXISTS "Players can create own profile" ON players;
DROP POLICY IF EXISTS "Users can create own profile" ON players;
DROP POLICY IF EXISTS "Admins can insert any player" ON players;

CREATE POLICY "Players can create own profile"
  ON players FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Admins or gestors can insert any player"
  ON players FOR INSERT TO authenticated
  WITH CHECK (is_admin_or_gestor_bypass());

-- UPDATE: próprio perfil OU admin/gestor
DROP POLICY IF EXISTS "Players can update own profile" ON players;
DROP POLICY IF EXISTS "Bootstrap: allow first profile update" ON players;
DROP POLICY IF EXISTS "Bootstrap: users can update profile when no admin exists" ON players;
DROP POLICY IF EXISTS "Admins can update any player" ON players;

CREATE POLICY "Players can update own profile"
  ON players FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins or gestors can update any player"
  ON players FOR UPDATE TO authenticated
  USING (is_admin_or_gestor_bypass())
  WITH CHECK (is_admin_or_gestor_bypass());

-- DELETE: apenas admin/gestor (coordenador NÃO pode apagar jogadores)
DROP POLICY IF EXISTS "Admins can delete any player" ON players;
CREATE POLICY "Admins or gestors can delete any player"
  ON players FOR DELETE TO authenticated
  USING (is_admin_or_gestor_bypass());

-- ============================================================
-- 6. GAMES — Políticas RLS
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view all games" ON games;
DROP POLICY IF EXISTS "All authenticated users can view games" ON games;
DROP POLICY IF EXISTS "Admins can create games" ON games;
DROP POLICY IF EXISTS "Captains and admins can create games" ON games;
DROP POLICY IF EXISTS "Admins can update games" ON games;
DROP POLICY IF EXISTS "Captains and admins can update games" ON games;
DROP POLICY IF EXISTS "Only admins can delete games" ON games;

CREATE POLICY "All authenticated can view games"
  ON games FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin gestor coordenador can create games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('admin', 'gestor', 'coordenador'));

CREATE POLICY "Admin gestor coordenador can update games"
  ON games FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('admin', 'gestor', 'coordenador'))
  WITH CHECK (get_current_user_role() IN ('admin', 'gestor', 'coordenador'));

CREATE POLICY "Only admin or gestor can delete games"
  ON games FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('admin', 'gestor'));

-- ============================================================
-- 7. RESULTS — Políticas RLS
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view all results" ON results;
DROP POLICY IF EXISTS "All authenticated users can view all results" ON results;
DROP POLICY IF EXISTS "Admins can view all results" ON results;
DROP POLICY IF EXISTS "Captains and admins can view all results" ON results;
DROP POLICY IF EXISTS "Admins can create results" ON results;
DROP POLICY IF EXISTS "Captains and admins can create results" ON results;
DROP POLICY IF EXISTS "Admins can update results" ON results;
DROP POLICY IF EXISTS "Captains and admins can update results" ON results;
DROP POLICY IF EXISTS "Only admins can delete results" ON results;

CREATE POLICY "All authenticated can view results"
  ON results FOR SELECT TO authenticated
  USING (true);

-- Inserir resultado: admin, gestor, coordenador OU capitão do jogo da sua equipa
CREATE POLICY "Admin gestor coordenador or captain can create results"
  ON results FOR INSERT TO authenticated
  WITH CHECK (
    get_current_user_role() IN ('admin', 'gestor', 'coordenador')
    OR (
      get_current_user_role() = 'capitao'
      AND EXISTS (
        SELECT 1 FROM games g
        WHERE g.id = game_id
        AND g.team_id = get_user_team_id()
      )
    )
  );

-- Atualizar resultado: mesma lógica
CREATE POLICY "Admin gestor coordenador or captain can update results"
  ON results FOR UPDATE TO authenticated
  USING (
    get_current_user_role() IN ('admin', 'gestor', 'coordenador')
    OR (
      get_current_user_role() = 'capitao'
      AND EXISTS (
        SELECT 1 FROM games g
        WHERE g.id = game_id
        AND g.team_id = get_user_team_id()
      )
    )
  )
  WITH CHECK (
    get_current_user_role() IN ('admin', 'gestor', 'coordenador')
    OR (
      get_current_user_role() = 'capitao'
      AND EXISTS (
        SELECT 1 FROM games g
        WHERE g.id = game_id
        AND g.team_id = get_user_team_id()
      )
    )
  );

CREATE POLICY "Only admin or gestor can delete results"
  ON results FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('admin', 'gestor'));

-- ============================================================
-- 8. Trigger availabilities: jogadores da equipa (capitao + jogador)
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
  AND role IN ('capitao', 'jogador')
  AND team_id = NEW.team_id;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 9. RPC admin_upsert_player: permitir a admin e gestor
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_upsert_player(
  p_user_id uuid,
  p_name text,
  p_email text,
  p_role text,
  p_team_id uuid,
  p_phone text DEFAULT NULL,
  p_federation_points int DEFAULT 0,
  p_preferred_side text DEFAULT 'both',
  p_points_updated_at timestamptz DEFAULT now()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_is_admin boolean;
  v_player_id uuid;
BEGIN
  SELECT is_user_admin() INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN json_build_object('ok', false, 'error', 'not_admin');
  END IF;

  INSERT INTO public.players (
    user_id, name, email, role, team_id, phone, federation_points,
    preferred_side, points_updated_at, is_active, profile_completed,
    created_at, updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(trim(p_name), ''),
    COALESCE(trim(lower(p_email)), ''),
    COALESCE(nullif(trim(p_role), ''), 'jogador'),
    p_team_id,
    nullif(trim(p_phone), ''),
    COALESCE(p_federation_points, 0),
    COALESCE(nullif(trim(p_preferred_side), ''), 'both'),
    COALESCE(p_points_updated_at, now()),
    true,
    true,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    team_id = EXCLUDED.team_id,
    phone = EXCLUDED.phone,
    federation_points = EXCLUDED.federation_points,
    preferred_side = EXCLUDED.preferred_side,
    points_updated_at = EXCLUDED.points_updated_at,
    profile_completed = EXCLUDED.profile_completed,
    updated_at = now();

  SELECT id INTO v_player_id FROM public.players WHERE user_id = p_user_id;
  RETURN json_build_object('ok', true, 'player_id', v_player_id);
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_team_id');
  WHEN OTHERS THEN
    RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

-- Nota: A RPC insert_game (se existir) pode continuar a usar role IN ('capitao','coordenador','admin').
-- Para que apenas admin, gestor e coordenador criem jogos (capitão só submete resultados),
-- atualiza manualmente a RPC insert_game para: get_current_user_role() IN ('admin','gestor','coordenador').
