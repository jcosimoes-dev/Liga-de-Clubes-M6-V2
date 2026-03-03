-- =============================================================================
-- Corrigir erro 54001 (stack depth limit exceeded) na tabela pairs
-- Causa: políticas RLS com sub-queries que criam recursão (ex.: policy em pairs
-- que chama função que lê players, e players tem policy que lê pairs).
--
-- Solução: REMOVER todas as políticas atuais e criar UMA política simples
-- que NÃO faz sub-queries à tabela pairs nem a tabelas que referenciem pairs.
-- =============================================================================

-- 1. Remover TODAS as políticas atuais da tabela pairs
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'pairs'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.pairs', pol.policyname);
  END LOOP;
END $$;

-- 2. Política única sem sub-queries (evita stack depth)
--    Opção A: Todos os autenticados podem tudo (para testar; depois restringe).
CREATE POLICY "Allow_Authenticated_Pairs_NoCycle"
  ON public.pairs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Se quiseres restringir por role via JWT (sem tocar em outras tabelas),
-- desativa a política acima e usa a seguinte (requer que o token JWT tenha
-- app_metadata.role = 3 ou 4 para Coordenador/Admin):
--
-- DROP POLICY IF EXISTS "Allow_Authenticated_Pairs_NoCycle" ON public.pairs;
-- CREATE POLICY "Allow_Admin_Pairs"
--   ON public.pairs FOR ALL TO authenticated
--   USING ( COALESCE((auth.jwt()->'app_metadata'->>'role')::int, 0) >= 3 )
--   WITH CHECK ( COALESCE((auth.jwt()->'app_metadata'->>'role')::int, 0) >= 3 );
