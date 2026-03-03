-- =============================================================================
-- RLS na tabela pairs: INSERT e UPDATE para Role 3 (Coordenador) e Role 4 (Admin)
-- Executar no SQL Editor do Supabase.
-- O role é validado na tabela public.players (user_id = auth.uid()).
-- =============================================================================

-- 1. Função helper: verifica se o utilizador autenticado pode gerir duplas (Role 3 Coordenador, Role 4 Admin).
--    Usa SECURITY DEFINER e row_security = off para ler players sem disparar RLS (evita recursão).
--    Valida a coluna role da tabela players (texto ou número: 'coordinator'/'3', 'admin'/'4').
CREATE OR REPLACE FUNCTION public.can_manage_pairs()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
DECLARE
  r text;
BEGIN
  SELECT COALESCE(role::text, '') INTO r
  FROM public.players
  WHERE user_id = auth.uid()
  LIMIT 1;
  RETURN r IN ('coordinator', 'admin', '3', '4');
END;
$$;

COMMENT ON FUNCTION public.can_manage_pairs() IS
  'True se o utilizador atual tem role Coordenador (3) ou Admin (4) na tabela players. Usado nas políticas RLS da tabela pairs.';

-- 2. Remover políticas antigas de pairs (apenas admin ou captain+admin)
DROP POLICY IF EXISTS "Admins can create pairs" ON pairs;
DROP POLICY IF EXISTS "Admins can update pairs" ON pairs;
DROP POLICY IF EXISTS "Admins can delete pairs" ON pairs;
DROP POLICY IF EXISTS "Admins can view all pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can create pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can update pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can delete pairs" ON pairs;
DROP POLICY IF EXISTS "Captains and admins can view all pairs" ON pairs;

-- 3. SELECT: todos os autenticados podem ver duplas (para listar pares nos jogos)
CREATE POLICY "Authenticated can view pairs"
  ON pairs FOR SELECT TO authenticated
  USING (true);

-- 4. INSERT: apenas Coordenador (3) e Admin (4)
CREATE POLICY "Coordinator and admin can insert pairs"
  ON pairs FOR INSERT TO authenticated
  WITH CHECK (can_manage_pairs());

-- 5. UPDATE: apenas Coordenador (3) e Admin (4)
CREATE POLICY "Coordinator and admin can update pairs"
  ON pairs FOR UPDATE TO authenticated
  USING (can_manage_pairs())
  WITH CHECK (can_manage_pairs());

-- 6. DELETE: apenas Coordenador (3) e Admin (4)
CREATE POLICY "Coordinator and admin can delete pairs"
  ON pairs FOR DELETE TO authenticated
  USING (can_manage_pairs());

-- Verificação (opcional): ver o role do utilizador atual
-- SELECT p.role, can_manage_pairs() FROM players p WHERE p.user_id = auth.uid();
