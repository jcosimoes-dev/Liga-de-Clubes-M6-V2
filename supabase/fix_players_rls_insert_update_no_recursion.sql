-- =============================================================================
-- Fix: infinite recursion (42P17) em INSERT/UPDATE na tabela "players"
-- =============================================================================
-- 1) Eliminar todas as políticas de INSERT e UPDATE na tabela players
-- 2) Criar novas políticas que usam apenas auth.uid() e user_id (sem SELECT em players)
-- =============================================================================

-- 1a) Remover políticas de INSERT e UPDATE por nome (migrações antigas)
DROP POLICY IF EXISTS "players_insert_own" ON public.players;
DROP POLICY IF EXISTS "players_update_own" ON public.players;
DROP POLICY IF EXISTS "Players can create own profile" ON public.players;
DROP POLICY IF EXISTS "Players can update own profile" ON public.players;
DROP POLICY IF EXISTS "Bootstrap: allow first profile creation" ON public.players;
DROP POLICY IF EXISTS "Bootstrap: allow first profile update" ON public.players;
DROP POLICY IF EXISTS "Bootstrap: users can insert profile when no admin exists" ON public.players;
DROP POLICY IF EXISTS "Bootstrap: users can update profile when no admin exists" ON public.players;
DROP POLICY IF EXISTS "Users can create own profile" ON public.players;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.players;
DROP POLICY IF EXISTS "Users can update own profile" ON public.players;
DROP POLICY IF EXISTS "Admins can insert any player" ON public.players;
DROP POLICY IF EXISTS "Admins can create any player" ON public.players;
DROP POLICY IF EXISTS "Admins can update any player" ON public.players;
DROP POLICY IF EXISTS "Admins can update all players" ON public.players;
DROP POLICY IF EXISTS "Only admins can insert players" ON public.players;
DROP POLICY IF EXISTS "Admins can insert players" ON public.players;
DROP POLICY IF EXISTS "Users can create own profile or admins can create any" ON public.players;
DROP POLICY IF EXISTS "Users can update players" ON public.players;

-- 1b) Remover qualquer outra política INSERT/UPDATE restante (pg_policies: cmd 'a'=INSERT, 'w'=UPDATE)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'players'
      AND (cmd = 'a' OR cmd = 'w')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.players', r.policyname);
  END LOOP;
END $$;

-- 2) Política INSERT: utilizador autenticado só pode inserir a sua linha (user_id = auth.uid())
CREATE POLICY "players_insert_own"
  ON public.players
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 3) Política UPDATE: utilizador autenticado só pode atualizar a sua linha
CREATE POLICY "players_update_own"
  ON public.players
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
