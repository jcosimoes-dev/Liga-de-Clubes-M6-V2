/*
  Criar função insert_game — contorna 409 do PostgREST

  Executa no Supabase SQL Editor e depois tenta criar o jogo novamente.
  game_status aceita: 'agendado', 'convocatoria_aberta', 'convocatoria_fechada',
  'concluido', 'open', 'closed', 'scheduled', 'completed'
*/

CREATE OR REPLACE FUNCTION public.insert_game(
  p_round_number integer,
  p_opponent text,
  p_location text,
  p_phase text,
  p_created_by uuid,
  p_team_id uuid DEFAULT NULL,
  p_starts_at timestamptz DEFAULT now()
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_can_insert boolean;
  v_row record;
  v_team_id uuid;
  v_created_by uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid()
      AND (role IN ('capitao', 'coordenador', 'admin') OR role::text = '4')
  ) INTO v_can_insert;

  IF NOT v_can_insert THEN
    RETURN json_build_object('ok', false, 'error', 'Acesso negado');
  END IF;

  v_team_id := NULL;
  IF p_team_id IS NOT NULL THEN
    SELECT id INTO v_team_id FROM public.teams WHERE id = p_team_id;
  END IF;

  v_created_by := COALESCE(auth.uid(), p_created_by);

  INSERT INTO public.games (
    jornada,
    opponent,
    location,
    phase,
    game_type,
    created_by,
    team_id,
    starts_at,
    status
  )
  VALUES (
    p_round_number,
    COALESCE(trim(p_opponent), ''),
    COALESCE(trim(p_location), ''),
    COALESCE(nullif(trim(p_phase), ''), 'Qualificação'),
    CASE
      WHEN p_phase IN ('Qualificação', 'Regionais', 'Nacionais') THEN 'Liga'::text
      ELSE COALESCE(nullif(trim(p_phase), ''), 'Liga')::text
    END,
    v_created_by,
    v_team_id,
    COALESCE(p_starts_at, now()),
    'convocatoria_aberta'::game_status
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'ok', true,
    'data', to_jsonb(v_row) || jsonb_build_object('round_number', v_row.jornada)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'Já existe um jogo com esta jornada/fase ou para esta data e hora.');
  WHEN foreign_key_violation THEN
    RETURN json_build_object('ok', false, 'error', 'Equipa ou perfil inválido.');
  WHEN undefined_column THEN
    RETURN json_build_object('ok', false, 'error', 'Coluna inexistente: ' || SQLERRM);
  WHEN OTHERS THEN
    RETURN json_build_object('ok', false, 'error', SQLERRM);
END;
$$;
