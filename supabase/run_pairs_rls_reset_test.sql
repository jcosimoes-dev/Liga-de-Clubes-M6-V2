-- =============================================================================
-- Reset de permissões RLS na tabela pairs (apenas para teste)
-- Executar no SQL Editor do Supabase.
-- Remove todas as políticas e cria uma única política FOR ALL com USING (true)
-- para permitir todas as operações a utilizadores autenticados (testar se o 500 desaparece).
--
-- Colunas da tabela pairs (referência): id, game_id, player1_id, player2_id,
-- total_points, pair_order, created_at, updated_at (não existe pair_number).
-- =============================================================================

-- Remover todas as políticas conhecidas em pairs
DROP POLICY IF EXISTS "Admins can create pairs" ON pairs;
DROP POLICY IF EXISTS "Admins can update pairs" ON pairs;
DROP POLICY IF EXISTS "Admins can delete pairs" ON pairs;
DROP POLICY IF EXISTS "Admins can view all pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can create pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can update pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can delete pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can view all pairs" ON pairs;
DROP POLICY IF EXISTS "Authenticated can view pairs" ON pairs;
DROP POLICY IF EXISTS "Coordinator and admin can insert pairs" ON pairs;
DROP POLICY IF EXISTS "Coordinator and admin can update pairs" ON pairs;
DROP POLICY IF EXISTS "Coordinator and admin can delete pairs" ON pairs;
DROP POLICY IF EXISTS "Authenticated users can view all pairs" ON pairs;
DROP POLICY IF EXISTS "Players can view own pairs" ON pairs;
DROP POLICY IF EXISTS "Users can view all pairs" ON pairs;

-- Uma única política permissiva (apenas para teste): todos os autenticados podem tudo
CREATE POLICY "pairs_allow_all_authenticated_test"
  ON pairs FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
