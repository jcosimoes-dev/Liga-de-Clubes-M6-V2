/*
  # Fix RLS Recursion in Players Table

  ## Problem
  The policies `admins_select_all_players` and `admins_update_players` cause infinite recursion
  because they query the `players` table to check if the user is an admin, while protecting
  the same `players` table.

  ## Solution
  1. Drop the recursive policies
  2. Create a security definer function that safely checks if a user is an admin
  3. Recreate the policies using the safe function

  ## Changes
  - Drop: `admins_select_all_players` policy
  - Drop: `admins_update_players` policy
  - Create: `is_admin()` function with security definer
  - Create: New non-recursive policies for admin access
*/

-- Drop the recursive policies
DROP POLICY IF EXISTS "admins_select_all_players" ON players;
DROP POLICY IF EXISTS "admins_update_players" ON players;

-- Create a security definer function to check if current user is admin
-- This function runs with elevated privileges and doesn't trigger RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM players 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Create non-recursive policies using the safe function
CREATE POLICY "Admins can view all players"
  ON players
  FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all players"
  ON players
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
