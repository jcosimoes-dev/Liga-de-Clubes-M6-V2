-- =============================================================================
-- Permitir que utilizadores com role 'admin' possam INSERT e UPDATE em players
-- (para criar/editar jogadores a partir do ecrã Adicionar Jogador).
-- Usa is_admin_bypass() para evitar recursão RLS (função SECURITY DEFINER).
-- =============================================================================

-- Garantir que a função is_admin_bypass existe (usa row_security = off para não disparar RLS)
CREATE OR REPLACE FUNCTION public.is_admin_bypass()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- INSERT: admin pode inserir qualquer linha em players (ex.: novo jogador criado pelo Admin)
DROP POLICY IF EXISTS "Admins can insert any player" ON public.players;
CREATE POLICY "Admins can insert any player"
  ON public.players
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_bypass());

-- UPDATE: admin pode atualizar qualquer linha em players (ex.: upsert no Adicionar Jogador)
DROP POLICY IF EXISTS "Admins can update any player" ON public.players;
CREATE POLICY "Admins can update any player"
  ON public.players
  FOR UPDATE
  TO authenticated
  USING (is_admin_bypass())
  WITH CHECK (is_admin_bypass());
