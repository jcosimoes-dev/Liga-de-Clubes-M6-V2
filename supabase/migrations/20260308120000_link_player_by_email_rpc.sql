/*
  Associar linha existente em players ao utilizador autenticado por email.

  Quando não existe linha com user_id = auth.uid() mas existe linha com o mesmo email
  (ex.: admin criado manualmente com user_id antigo ou null), esta RPC atualiza
  essa linha para user_id = auth.uid() para evitar criar segunda linha com role jogador.

  Só atualiza linhas onde email = email do JWT e (user_id IS NULL OR user_id = auth.uid()).
*/

CREATE OR REPLACE FUNCTION public.link_player_profile_by_email()
RETURNS SETOF public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  v_email := LOWER(TRIM(auth.jwt() ->> 'email'));
  IF v_uid IS NULL OR v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  UPDATE public.players
  SET user_id = v_uid
  WHERE id = (
    SELECT id FROM public.players
    WHERE LOWER(TRIM(COALESCE(email, ''))) = v_email
      AND (user_id IS NULL OR user_id = v_uid)
    LIMIT 1
  );

  RETURN QUERY SELECT * FROM public.players WHERE user_id = v_uid LIMIT 1;
END;
$$;
