/*
  # Allow admins to appear in team list
  
  1. Changes
    - Modifies `get_team_players()` RPC function
    - Removes the exclusion of admin role
    - Now all active players appear in team list (jogador, capitao, coordenador, admin)
  
  2. Reasoning
    - Admins can also be players on a team
    - They need to appear in team list to be visible to other players
    - They still have admin privileges for system management
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
  ORDER BY p.federation_points DESC;
END;
$$;
