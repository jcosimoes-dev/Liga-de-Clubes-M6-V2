/*
  # Corrigir RPC admin_upsert_player

  1. preferred_side: coluna pode ser enum; garantir tipo existe e converter texto para enum
  2. created_at, updated_at: não enviar manualmente; deixar a BD tratar via DEFAULT/trigger
*/

-- Garantir que o tipo enum preferred_side existe (se a coluna for enum)
DO $$
BEGIN
  CREATE TYPE preferred_side AS ENUM ('left', 'right', 'both');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
  v_preferred_side text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid() AND role IN ('admin', 'gestor')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN json_build_object('ok', false, 'error', 'not_admin');
  END IF;

  v_new_role := COALESCE(nullif(trim(p_role), ''), 'jogador');
  v_preferred_side := COALESCE(nullif(trim(p_preferred_side), ''), 'both');
  IF v_preferred_side NOT IN ('left', 'right', 'both') THEN
    v_preferred_side := 'both';
  END IF;

  -- Não incluir created_at nem updated_at; a BD trata via DEFAULT e trigger
  -- preferred_side: cast para enum se a coluna for do tipo preferred_side (evita erro text vs enum)
  INSERT INTO public.players (
    user_id, name, email, role, team_id, phone, federation_points,
    preferred_side, points_updated_at, is_active, profile_completed
  )
  VALUES (
    p_user_id,
    COALESCE(trim(p_name), ''),
    COALESCE(trim(lower(p_email)), ''),
    v_new_role,
    p_team_id,
    nullif(trim(p_phone), ''),
    COALESCE(p_federation_points, 0),
    v_preferred_side::preferred_side,
    COALESCE(p_points_updated_at, now()),
    true,
    true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
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
    profile_completed = EXCLUDED.profile_completed
  RETURNING id INTO v_player_id;

  RETURN json_build_object('ok', true, 'player_id', v_player_id);
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_team_id');
  WHEN OTHERS THEN
    RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;
