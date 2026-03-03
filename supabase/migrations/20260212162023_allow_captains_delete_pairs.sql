/*
  # Allow Captains to Delete Pairs

  ## Summary
  Permite que capitães apaguem duplas para poderem editá-las.

  ## Changes
  1. Remove política restritiva que só permitia admins
  2. Cria nova política que permite capitães e admins apagarem duplas
*/

DROP POLICY IF EXISTS "Only admins can delete pairs" ON pairs;

CREATE POLICY "Captains and admins can delete pairs" 
  ON pairs FOR DELETE TO authenticated 
  USING (get_current_user_role() IN ('captain', 'admin'));
