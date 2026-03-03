-- =============================================================================
-- 2B. PAIRS – Só as políticas RLS (correr DEPOIS de 02a e sem erros)
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can view all pairs" ON pairs;
CREATE POLICY "Authenticated users can view all pairs"
  ON pairs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Captains can insert pairs" ON pairs;
CREATE POLICY "Captains can insert pairs"
  ON pairs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')));

DROP POLICY IF EXISTS "Captains can update pairs" ON pairs;
CREATE POLICY "Captains can update pairs"
  ON pairs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')));

DROP POLICY IF EXISTS "Captains can delete pairs" ON pairs;
CREATE POLICY "Captains can delete pairs"
  ON pairs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM players WHERE user_id = auth.uid() AND role IN ('captain', 'coordinator', 'admin')));
