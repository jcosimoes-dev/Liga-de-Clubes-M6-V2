/*
  # Adicionar políticas UPDATE para admins e capitães em availabilities
  
  1. Problema
    - Apenas jogadores têm política explícita para UPDATE na própria disponibilidade
    - Admins e capitães podem precisar de atualizar disponibilidades de outros jogadores
  
  2. Solução
    - Adicionar política UPDATE para admins e capitães
    - Permitir que eles atualizem qualquer disponibilidade
*/

-- Adicionar política UPDATE para admins e capitães
CREATE POLICY "Admins and captains can update all availabilities"
  ON availabilities FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('capitao', 'admin'))
  WITH CHECK (get_current_user_role() IN ('capitao', 'admin'));
