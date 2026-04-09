/*
  Capitão: permitir UPDATE em jogos da sua equipa enquanto a convocatória está aberta
  (data, local, adversário — alinha RLS com a Gestão Desportiva: open_convocation + Editar Jogo).

  A política existente "Admin gestor coordenador can update games" mantém-se; esta é adicional (OR).
*/

DROP POLICY IF EXISTS "Captain can update own team open games" ON public.games;

CREATE POLICY "Captain can update own team open games"
  ON public.games FOR UPDATE TO authenticated
  USING (
    get_current_user_role() = 'capitao'
    AND team_id IS NOT NULL
    AND team_id = get_user_team_id()
    AND lower(trim(status::text)) IN (
      'convocatoria_aberta',
      'open',
      'agendado',
      'scheduled',
      'pendente',
      'pending',
      'aberto'
    )
  )
  WITH CHECK (
    get_current_user_role() = 'capitao'
    AND team_id IS NOT NULL
    AND team_id = get_user_team_id()
    AND lower(trim(status::text)) IN (
      'convocatoria_aberta',
      'open',
      'agendado',
      'scheduled',
      'pendente',
      'pending',
      'aberto'
    )
  );
