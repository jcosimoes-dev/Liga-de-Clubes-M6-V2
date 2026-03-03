/*
  # Add function to check if admin exists
  
  1. Changes
    - Creates RPC function `has_admin()` that bypasses RLS to check if any admin exists
    - This allows any authenticated user to check if the system has been bootstrapped
    - Security definer ensures it runs with elevated privileges to bypass RLS
  
  2. Security
    - Function only returns boolean, no sensitive data exposed
    - Only checks existence, doesn't return admin details
*/

CREATE OR REPLACE FUNCTION has_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM players 
    WHERE role = 'admin'
    LIMIT 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION has_admin() TO authenticated;
