/*
  RPC de diagnóstico: o que a BD vê no contexto do utilizador autenticado.
  Usado antes de guardar alteração de role para verificar auth.uid(), linha em players e bypass.

  Retorna JSON:
  - auth_uid: uuid do auth.uid() (null se não autenticado ou se chamado com service role)
  - player_id: id da linha em players onde user_id = auth.uid()
  - player_email: email dessa linha
  - player_role: role dessa linha
  - bypass: resultado de is_admin_or_gestor_bypass()
*/

CREATE OR REPLACE FUNCTION public.debug_admin_bypass()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid uuid;
  v_player_id uuid;
  v_player_email text;
  v_player_role text;
  v_bypass boolean;
BEGIN
  v_uid := auth.uid();
  v_bypass := public.is_admin_or_gestor_bypass();

  IF v_uid IS NOT NULL THEN
    SELECT id, COALESCE(email::text, ''), COALESCE(role::text, '')
      INTO v_player_id, v_player_email, v_player_role
      FROM public.players
      WHERE user_id = v_uid
      LIMIT 1;
  END IF;

  RETURN json_build_object(
    'auth_uid', v_uid,
    'player_id', v_player_id,
    'player_email', COALESCE(v_player_email, ''),
    'player_role', COALESCE(v_player_role, ''),
    'bypass', COALESCE(v_bypass, false)
  );
END;
$$;
