/*
  # Fix Pairs Delete Policy Role Name

  ## Summary
  Corrige o nome do role na política DELETE de 'captain' para 'capitao'
  para manter consistência com as outras políticas.

  ## Changes
  - Remove política com nome em inglês
  - Cria nova política com nome correto em português
*/

DROP POLICY IF EXISTS "Captains and admins can delete pairs" ON pairs;

CREATE POLICY "Captains and admins can delete pairs"
  ON pairs FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('capitao', 'admin'));
