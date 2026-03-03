/*
  # Fix RLS Performance Issues with auth.uid() calls

  1. Problem
    - Several RLS policies re-evaluate auth.uid() for each row
    - This causes suboptimal query performance at scale
  
  2. Solution
    - Replace auth.uid() with (select auth.uid()) in all policies
    - This ensures the function is evaluated once per query, not per row
  
  3. Affected Policies on players table
    - Bootstrap: allow first profile creation
    - Bootstrap: allow first profile update
    - Players can create own profile
    - Players can update own profile
*/

-- Drop and recreate policies with optimized auth function calls

-- Bootstrap policies
DROP POLICY IF EXISTS "Bootstrap: allow first profile creation" ON players;
CREATE POLICY "Bootstrap: allow first profile creation"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id 
    AND NOT EXISTS (SELECT 1 FROM players WHERE user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS "Bootstrap: allow first profile update" ON players;
CREATE POLICY "Bootstrap: allow first profile update"
  ON players
  FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) = user_id 
    AND NOT EXISTS (SELECT 1 FROM players WHERE user_id != (select auth.uid()) AND role IN ('admin', 'capitao', 'coordenador', 'jogador'))
  )
  WITH CHECK (
    (select auth.uid()) = user_id
  );

-- Regular player policies
DROP POLICY IF EXISTS "Players can create own profile" ON players;
CREATE POLICY "Players can create own profile"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Players can update own profile" ON players;
CREATE POLICY "Players can update own profile"
  ON players
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
