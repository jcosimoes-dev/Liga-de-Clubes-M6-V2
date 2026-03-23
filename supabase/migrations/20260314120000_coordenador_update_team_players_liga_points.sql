/*
  # Coordenador: atualizar jogadores da mesma equipa (liga_points + federation_points)

  Problema: só admin/gestor tinham política UPDATE em players; o trigger repunha liga_points
  para não-admin. O coordenador precisa de gravar pontos Liga e FPP na Equipa.

  1. Nova política RLS: coordenador pode fazer UPDATE em linhas de players com o mesmo team_id.
  2. Trigger players_sanitize_restricted_columns: ramo para coordenador da mesma equipa —
     preserva NEW.liga_points e NEW.federation_points (e demais campos de perfil já permitidos).
*/

-- ============================================================
-- 1. RLS: coordenador pode atualizar jogadores da sua equipa
-- ============================================================

DROP POLICY IF EXISTS "Coordenador can update team players profiles" ON public.players;

CREATE POLICY "Coordenador can update team players profiles"
  ON public.players
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.players me
      WHERE me.user_id = auth.uid()
        AND me.role = 'coordenador'
        AND me.team_id IS NOT NULL
        AND me.team_id = players.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.players me
      WHERE me.user_id = auth.uid()
        AND me.role = 'coordenador'
        AND me.team_id IS NOT NULL
        AND me.team_id = players.team_id
    )
  );

COMMENT ON POLICY "Coordenador can update team players profiles" ON public.players IS
  'Permite ao coordenador atualizar perfil e pontos (liga_points, federation_points) dos jogadores da mesma equipa.';

-- ============================================================
-- 2. Trigger: coordenador mesma equipa — não repor liga_points ao OLD
-- ============================================================

CREATE OR REPLACE FUNCTION public.players_sanitize_restricted_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_my_team_id uuid;
  v_my_role text;
BEGIN
  IF OLD.role IN ('admin', 'gestor', 'coordenador', 'capitao')
     AND (NEW.role IS NULL OR TRIM(LOWER(NEW.role::text)) IN ('jogador', 'player')) THEN
    NEW.role := OLD.role;
  END IF;

  IF public.is_admin_or_gestor_bypass() THEN
    RETURN NEW;
  END IF;

  SELECT p.team_id, p.role INTO v_my_team_id, v_my_role
  FROM public.players p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF v_my_role = 'coordenador'
     AND v_my_team_id IS NOT NULL
     AND OLD.team_id IS NOT DISTINCT FROM v_my_team_id
     AND NEW.team_id IS NOT DISTINCT FROM v_my_team_id
  THEN
    NEW.id := OLD.id;
    NEW.user_id := OLD.user_id;
    NEW.role := OLD.role;
    NEW.email := OLD.email;
    NEW.created_at := OLD.created_at;
    NEW.team_id := OLD.team_id;
    NEW.points_updated_at := OLD.points_updated_at;
    NEW.profile_completed := OLD.profile_completed;
    -- liga_points, federation_points, name, phone, preferred_side, is_active, must_change_password: NEW
    RETURN NEW;
  END IF;

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

COMMENT ON FUNCTION public.players_sanitize_restricted_columns() IS
  'Admin/gestor: sem sanitização extra. Coordenador da mesma equipa: protege identidade mas permite liga_points/federation_points. Outros: repõe colunas protegidas.';
