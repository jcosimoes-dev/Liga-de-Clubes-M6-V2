/*
  # Fix get_current_user_role Function - Explicitly Disable RLS

  ## Problem
  The function may still be subject to RLS checks despite SECURITY DEFINER.

  ## Solution
  Add explicit configuration to disable RLS within the function.

  ## Changes
  1. Add row_security = off to the function
*/

-- Recreate function with RLS explicitly disabled
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM players
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN user_role;
END;
$$;
