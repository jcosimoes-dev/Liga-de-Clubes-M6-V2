/*
  # Fix All Admin Policies - Remove RLS Recursion

  ## Problem
  Multiple admin policies use is_admin() which causes RLS recursion
  when the function queries the players table.

  ## Solution
  Update all admin policies to use is_admin_bypass() instead.

  ## Changes
  1. Update SELECT policy for admins
  2. Update UPDATE policy for admins
*/

-- Drop and recreate SELECT policy
DROP POLICY IF EXISTS "Admins can view all players" ON players;
CREATE POLICY "Admins can view all players"
  ON players
  FOR SELECT
  TO authenticated
  USING (is_admin_bypass());

-- Drop and recreate UPDATE policy
DROP POLICY IF EXISTS "Admins can update all players" ON players;
CREATE POLICY "Admins can update all players"
  ON players
  FOR UPDATE
  TO authenticated
  USING (is_admin_bypass())
  WITH CHECK (is_admin_bypass());
