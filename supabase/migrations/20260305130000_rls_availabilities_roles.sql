/*
  # RLS para availabilities (ligação jogos–jogadores)

  Nota: A tabela que guarda a ligação entre jogos e jogadores é AVAILABILITIES
  (game_id + player_id + status), não "game_players". Não existe tabela game_players no schema.

  Admin, gestor, coordenador e capitao: podem inserir e editar (gerir convocatórias).
  Jogadores: podem atualizar a própria disponibilidade (confirmar/talvez/recusar).
  Todos autenticados: podem ver.
*/

-- Remover políticas antigas que possam restringir a gestão
DROP POLICY IF EXISTS "Admins can update all availabilities" ON availabilities;
DROP POLICY IF EXISTS "Admins can view all availabilities" ON availabilities;
DROP POLICY IF EXISTS "Admins and captains can update all availabilities" ON availabilities;
DROP POLICY IF EXISTS "Captains and admins can view all availabilities" ON availabilities;
DROP POLICY IF EXISTS "All authenticated users can view availabilities" ON availabilities;
DROP POLICY IF EXISTS "Players can update own availability" ON availabilities;
DROP POLICY IF EXISTS "Players can update their own availability" ON availabilities;

-- SELECT: todos os autenticados podem ver
CREATE POLICY "All authenticated can view availabilities"
  ON availabilities FOR SELECT TO authenticated
  USING (true);

-- INSERT: admin, gestor, coordenador, capitao (e trigger ao criar jogo)
CREATE POLICY "Admin gestor coordenador capitao can insert availabilities"
  ON availabilities FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('admin', 'gestor', 'coordenador', 'capitao'));

-- UPDATE: próprio (jogador atualiza a sua) ou admin/gestor/coordenador/capitao
CREATE POLICY "Players can update own availability"
  ON availabilities FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM players WHERE players.id = availabilities.player_id AND players.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM players WHERE players.id = availabilities.player_id AND players.user_id = auth.uid())
  );

CREATE POLICY "Admin gestor coordenador capitao can update availabilities"
  ON availabilities FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('admin', 'gestor', 'coordenador', 'capitao'))
  WITH CHECK (get_current_user_role() IN ('admin', 'gestor', 'coordenador', 'capitao'));
