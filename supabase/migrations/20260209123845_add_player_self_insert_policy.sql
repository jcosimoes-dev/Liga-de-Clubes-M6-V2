/*
  # Adicionar política para jogadores criarem o próprio perfil

  1. Alteração
    - Adicionar policy para permitir que um utilizador autenticado crie o seu próprio perfil
    - Necessário para o processo de signup funcionar correctamente

  2. Segurança
    - Apenas pode criar perfil para o próprio user_id (auth.uid())
*/

-- Política: Utilizadores autenticados podem criar o próprio perfil
CREATE POLICY "Users can create own profile"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
