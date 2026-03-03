/*
  # Melhorar Visibilidade de Jogadores para Gestão

  1. Alterações
    - Ajustar política SELECT de players para garantir que capitães e coordenadores vejam toda a equipa
    - Admin continua a ver todos
    - Jogadores regulares vêem apenas o próprio perfil

  2. Segurança
    - Capitães e coordenadores precisam ver toda a equipa para gestão
    - Jogadores regulares mantêm privacidade (só vêem próprio perfil)
    - Admin mantém acesso global
*/

-- Remover política antiga de SELECT
DROP POLICY IF EXISTS "Users can view players" ON players;

-- Nova política: Admin vê todos, Capitão/Coordenador vêem toda a equipa, Jogador vê só próprio perfil
CREATE POLICY "Players visibility by role"
  ON players
  FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    team_id = get_user_team_id() AND EXISTS (
      SELECT 1 FROM players p
      WHERE p.user_id = auth.uid()
      AND p.role IN ('capitao', 'coordenador')
    ) OR
    user_id = auth.uid()
  );
