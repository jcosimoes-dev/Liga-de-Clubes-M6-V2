/*
  # Proteger roles elevadas — nunca rebaixar para jogador

  Regras:
  - Novos utilizadores => role 'jogador' (já garantido por DEFAULT e pelo frontend).
  - admin, coordenador, capitao (e gestor) existentes NUNCA podem ser automaticamente
    rebaixados para jogador por upsert, sync ou update.
  - Promoção para capitao/coordenador/admin continua a ser manual (Admin/Equipa).

  1. Trigger players: em qualquer UPDATE, se a linha já tem role elevada e o novo valor
     é jogador/player, manter a role antiga.
  2. RPC admin_upsert_player: em ON CONFLICT, não sobrescrever role se a linha existente
     tiver role elevada (a menos que o novo valor também seja elevado).
*/

-- ============================================================
-- 1. TRIGGER: nunca rebaixar admin/gestor/coordenador/capitao para jogador
-- ============================================================

CREATE OR REPLACE FUNCTION public.players_sanitize_restricted_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nunca permitir rebaixar roles elevadas para jogador (mesmo quando o updater é admin)
  IF OLD.role IN ('admin', 'gestor', 'coordenador', 'capitao')
     AND (NEW.role IS NULL OR TRIM(LOWER(NEW.role::text)) IN ('jogador', 'player')) THEN
    NEW.role := OLD.role;
  END IF;

  -- Admin e gestor podem alterar outras colunas; não-admin não pode alterar colunas protegidas
  IF public.is_admin_or_gestor_bypass() THEN
    RETURN NEW;
  END IF;

  -- Utilizador normal: manter colunas protegidas iguais ao valor antigo
  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.role := OLD.role;
  NEW.email := OLD.email;
  NEW.created_at := OLD.created_at;
  NEW.team_id := OLD.team_id;
  NEW.liga_points := OLD.liga_points;
  NEW.points_updated_at := OLD.points_updated_at;
  NEW.profile_completed := OLD.profile_completed;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. RPC admin_upsert_player: em conflito, preservar role elevada existente
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
  v_new_role text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN json_build_object('ok', false, 'error', 'not_admin');
  END IF;

  v_new_role := COALESCE(nullif(trim(p_role), ''), 'jogador');

  INSERT INTO public.players (
    user_id, name, email, role, team_id, phone, federation_points,
    preferred_side, points_updated_at, is_active, profile_completed,
    created_at, updated_at
  )
  VALUES (
    p_user_id,
    COALESCE(trim(p_name), ''),
    COALESCE(trim(lower(p_email)), ''),
    v_new_role,
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
    -- Preservar role elevada existente; nunca sobrescrever com jogador
    role = CASE
      WHEN players.role IN ('admin', 'gestor', 'coordenador', 'capitao')
           AND (EXCLUDED.role IS NULL OR TRIM(LOWER(EXCLUDED.role::text)) IN ('jogador', 'player'))
      THEN players.role
      ELSE EXCLUDED.role
    END,
    team_id = EXCLUDED.team_id,
    phone = EXCLUDED.phone,
    federation_points = EXCLUDED.federation_points,
    preferred_side = EXCLUDED.preferred_side,
    points_updated_at = EXCLUDED.points_updated_at,
    profile_completed = EXCLUDED.profile_completed,
    updated_at = now()
  RETURNING id INTO v_player_id;

  RETURN json_build_object('ok', true, 'player_id', v_player_id);
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_team_id');
  WHEN OTHERS THEN
    RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.players_sanitize_restricted_columns() IS 'Protege colunas restritas para não-admin; nunca permite rebaixar admin/gestor/coordenador/capitao para jogador.';
