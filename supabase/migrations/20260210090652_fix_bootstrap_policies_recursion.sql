/*
  # Fix Bootstrap Policies Recursion

  ## Problem
  Bootstrap policies still check for admin existence by querying the players table,
  which can cause recursion issues.

  ## Solution
  1. Create a safe function to check if any admin exists
  2. Replace bootstrap policies with non-recursive versions

  ## Changes
  - Drop recursive bootstrap policies
  - Create `admin_exists()` security definer function
  - Create new non-recursive bootstrap policies
*/

-- Drop old bootstrap policies
DROP POLICY IF EXISTS "Allow bootstrap insert when no admin exists" ON players;
DROP POLICY IF EXISTS "Allow bootstrap update when no admin exists" ON players;

-- Create a security definer function to safely check if any admin exists
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM players 
    WHERE role = 'admin'
  );
$$;

-- Recreate bootstrap policies using the safe function
CREATE POLICY "Bootstrap: users can insert profile when no admin exists"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND NOT admin_exists()
  );

CREATE POLICY "Bootstrap: users can update profile when no admin exists"
  ON players
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND NOT admin_exists()
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND NOT admin_exists()
  );
