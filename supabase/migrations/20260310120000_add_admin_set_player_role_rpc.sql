/*
  RPC dedicada para alteração de role por administrador.
  Chamada pelo cliente normal (sessão autenticada). Não depende de UPDATE genérico em players.

  - Só quem tem role = 'admin' em players (para user_id = auth.uid()) pode chamar.
  - new_role só pode ser: 'admin', 'coordenador', 'capitao', 'jogador'.
  - Devolve a linha actualizada (ou vazio se nenhuma linha afectada).
*/

CREATE OR REPLACE FUNCTION public.admin_set_player_role(
  p_target_player_id uuid,
  p_new_role text
)
RETURNS SETOF public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_valid_roles text[] := ARRAY['admin', 'coordenador', 'capitao', 'jogador'];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = v_uid AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar funções';
  END IF;

  IF p_new_role IS NULL OR NOT (TRIM(LOWER(p_new_role)) = ANY(v_valid_roles)) THEN
    RAISE EXCEPTION 'Role inválida: %. Permitidas: admin, coordenador, capitao, jogador', p_new_role;
  END IF;

  RETURN QUERY
  UPDATE public.players
  SET role = TRIM(LOWER(p_new_role))
  WHERE id = p_target_player_id
  RETURNING *;
END;
$$;
