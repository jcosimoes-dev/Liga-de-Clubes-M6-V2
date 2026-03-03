/*
  # Permitir Auto-Criação de Perfis

  1. Alterações
    - Ajustar política INSERT de players para permitir que utilizadores criem o próprio perfil
    - Admins continuam a poder criar perfis para outros utilizadores
    - Utilizadores normais só podem criar o próprio perfil (user_id = auth.uid())

  2. Segurança
    - Utilizador só pode fazer INSERT com user_id igual ao seu auth.uid()
    - Previne criação de perfis para outros utilizadores
    - Mantém capacidade de admins criarem qualquer perfil
*/

-- Remover política antiga de INSERT
DROP POLICY IF EXISTS "Only admins can insert players" ON players;

-- Nova política: Admins podem criar qualquer perfil, utilizadores podem criar próprio perfil
CREATE POLICY "Users can create own profile or admins can create any"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() OR auth.uid() = user_id
  );
