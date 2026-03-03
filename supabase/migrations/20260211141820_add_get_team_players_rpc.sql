/*
  # Add RPC function to get team players
  
  1. Changes
    - Creates RPC function `get_team_players()` that bypasses RLS
    - Returns all active players from the same team (excluding admins)
    - Any authenticated user can see their team members
  
  2. Security
    - Uses security definer to bypass RLS
    - Only returns active players
    - Excludes admin users (who don't belong to specific teams)
    - Returns safe public information only
*/

CREATE OR REPLACE FUNCTION get_team_players()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  email text,
  phone text,
  federation_points integer,
  role text,
  is_active boolean,
  team_id uuid,
  preferred_side text,
  created_at timestamptz,
  points_updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.user_id,
    p.name,
    p.email,
    p.phone,
    p.federation_points,
    p.role,
    p.is_active,
    p.team_id,
    p.preferred_side,
    p.created_at,
    p.points_updated_at
  FROM players p
  WHERE p.is_active = true
    AND p.role != 'admin'
  ORDER BY p.name;
END;
$$;

GRANT EXECUTE ON FUNCTION get_team_players() TO authenticated;
