-- =============================================================================
-- Fix: infinite recursion in RLS policies for table "players" (42P17)
-- =============================================================================
-- Causa: políticas que usam SELECT/EXISTS na própria tabela 'players' (ex. para
-- bootstrap ou para verificar role) disparam RLS de novo ao avaliar → recursão.
-- Solução: remover todas as políticas em 'players' e criar apenas políticas
-- que usam auth.uid() e a coluna user_id da linha, sem consultar 'players'.
-- =============================================================================

-- 1) Remover todas as políticas existentes na tabela players
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'players'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.players', r.policyname);
  END LOOP;
END $$;

-- 2) Garantir que RLS está ativo
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- 3) Novas políticas SEM qualquer SELECT na tabela players
--    Apenas: (select auth.uid()) e coluna user_id da linha.

-- SELECT: utilizador autenticado vê apenas a sua própria linha
CREATE POLICY "players_select_own"
  ON public.players
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- INSERT: utilizador autenticado pode inserir apenas a sua própria linha (registo)
CREATE POLICY "players_insert_own"
  ON public.players
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- UPDATE: utilizador autenticado pode atualizar apenas a sua própria linha
CREATE POLICY "players_update_own"
  ON public.players
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- DELETE: utilizador autenticado pode apagar apenas a sua própria linha (opcional)
CREATE POLICY "players_delete_own"
  ON public.players
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
