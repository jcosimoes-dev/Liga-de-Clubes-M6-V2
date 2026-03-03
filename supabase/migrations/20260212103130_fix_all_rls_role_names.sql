/*
  # Corrigir todas as políticas RLS para usar nomes de roles corretos

  1. Problema
    - Múltiplas tabelas verificam contra 'captain' (inglês)
    - Os roles na tabela players são 'capitao', 'admin', 'coordenador', 'jogador' (português/misto)

  2. Solução
    - Actualizar todas as políticas de availabilities, pairs e results
    - Garantir que 'capitao' e 'admin' têm as permissões correctas em todas as tabelas
*/

-- ============================================================
-- AVAILABILITIES TABLE
-- ============================================================

DROP POLICY IF EXISTS "Captains and admins can view all availabilities" ON availabilities;

CREATE POLICY "Captains and admins can view all availabilities"
  ON availabilities FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('capitao', 'admin'));

-- ============================================================
-- PAIRS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Captains and admins can view all pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can create pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can update pairs" ON pairs;

CREATE POLICY "Captains and admins can view all pairs"
  ON pairs FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('capitao', 'admin'));

CREATE POLICY "Captains and admins can create pairs"
  ON pairs FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('capitao', 'admin'));

CREATE POLICY "Captains and admins can update pairs"
  ON pairs FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('capitao', 'admin'))
  WITH CHECK (get_current_user_role() IN ('capitao', 'admin'));

-- ============================================================
-- RESULTS TABLE
-- ============================================================

DROP POLICY IF EXISTS "Captains and admins can view all results" ON results;
DROP POLICY IF EXISTS "Captains and admins can create results" ON results;
DROP POLICY IF EXISTS "Captains and admins can update results" ON results;

CREATE POLICY "Captains and admins can view all results"
  ON results FOR SELECT TO authenticated
  USING (get_current_user_role() IN ('capitao', 'admin'));

CREATE POLICY "Captains and admins can create results"
  ON results FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('capitao', 'admin'));

CREATE POLICY "Captains and admins can update results"
  ON results FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('capitao', 'admin'))
  WITH CHECK (get_current_user_role() IN ('capitao', 'admin'));
