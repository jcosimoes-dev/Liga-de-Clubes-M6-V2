/*
  # Fix Admin INSERT Policy - Final Solution

  ## Problem
  Admin INSERT policy may still have recursion issues with subquery.

  ## Solution
  Create a security definer function that explicitly bypasses RLS by setting
  the security context appropriately. Then use this in the policy.

  ## Changes
  1. Create get_current_user_role() function with SECURITY DEFINER
  2. Recreate INSERT policy using this function
  3. Also update SELECT and UPDATE policies for consistency
*/

-- Create a function that gets the user's role without triggering RLS
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Explicitly bypass RLS by using a direct query
  SELECT role INTO user_role
  FROM players
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN user_role;
END;
$$;

-- Recreate INSERT policy
DROP POLICY IF EXISTS "Admins can insert any player" ON players;
CREATE POLICY "Admins can insert any player"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (get_current_user_role() = 'admin');

-- Recreate SELECT policy  
DROP POLICY IF EXISTS "Admins can view all players" ON players;
CREATE POLICY "Admins can view all players"
  ON players
  FOR SELECT
  TO authenticated
  USING (get_current_user_role() = 'admin');

-- Recreate UPDATE policy
DROP POLICY IF EXISTS "Admins can update all players" ON players;
CREATE POLICY "Admins can update all players"
  ON players
  FOR UPDATE
  TO authenticated
  USING (get_current_user_role() = 'admin')
  WITH CHECK (get_current_user_role() = 'admin');
