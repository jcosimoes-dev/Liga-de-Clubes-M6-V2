/*
  # Fix Admin INSERT Policy - Remove Recursion

  ## Problem
  The is_admin() function causes RLS recursion:
  - INSERT policy calls is_admin()
  - is_admin() does SELECT on players
  - SELECT policy also calls is_admin()
  - Creates infinite loop

  ## Solution
  Create a new is_admin_bypass() function with SECURITY DEFINER that bypasses RLS,
  and update the INSERT policy to use it.

  ## Changes
  1. Create is_admin_bypass() function that bypasses RLS
  2. Drop old admin INSERT policy
  3. Create new admin INSERT policy using the bypass function
*/

-- Create bypass function that doesn't trigger RLS
CREATE OR REPLACE FUNCTION is_admin_bypass()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM players 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
END;
$$;

-- Drop the old policy
DROP POLICY IF EXISTS "Admins can insert any player" ON players;

-- Create new policy with bypass function
CREATE POLICY "Admins can insert any player"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_bypass());
