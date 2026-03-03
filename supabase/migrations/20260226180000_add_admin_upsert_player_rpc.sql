-- =============================================================================
-- RPC para o Admin criar/atualizar jogador na tabela players (contorna RLS).
-- Garante que o jogador aparece nos menus após signUp em auth.users.
-- =============================================================================

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
  -- Apenas utilizadores com role 'admin' na tabela players podem chamar
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;

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
    COALESCE(nullif(trim(p_role), ''), 'player'),
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

GRANT EXECUTE ON FUNCTION public.admin_upsert_player(uuid, text, text, text, uuid, text, int, text, timestamptz) TO authenticated;
