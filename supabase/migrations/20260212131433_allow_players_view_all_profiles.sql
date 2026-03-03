/*
  # Allow Players to View All Profiles

  ## Summary
  Allow all authenticated users to view basic information of all players so they can see who confirmed presence in games.

  ## Changes
  1. Add policy allowing all authenticated users to view all players
  2. This is necessary for:
     - Viewing who confirmed presence in games
     - Seeing teammate names in availability lists
     - Displaying player names in pairs and results

  ## Security Considerations
  - Player profiles contain non-sensitive information (name, role, points)
  - No sensitive data like emails or passwords are in the players table
  - Players can still only UPDATE their own profile
  - Only admins can DELETE players
*/

-- Drop the restrictive policy that only allows users to view their own profile
DROP POLICY IF EXISTS "Players can view own profile" ON players;

-- Create a new policy allowing all authenticated users to view all players
CREATE POLICY "All authenticated users can view all players"
  ON players
  FOR SELECT
  TO authenticated
  USING (true);
