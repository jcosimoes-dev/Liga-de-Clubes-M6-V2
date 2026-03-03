/*
  # Fix Availabilities Visibility for All Users

  ## Summary
  Allow all authenticated users to view all availabilities so they can see how many players have confirmed for each game.

  ## Changes
  1. Drop existing restrictive SELECT policies on availabilities
  2. Create new policy allowing all authenticated users to view all availabilities
  3. Keep existing policies for INSERT, UPDATE, DELETE (players can only modify their own)

  ## Security Considerations
  - Availabilities are not sensitive data (just presence confirmation status)
  - All team members should see who's confirmed for games
  - Players can still only create/update/delete their own availability records
*/

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Players can view own availability" ON availabilities;
DROP POLICY IF EXISTS "Captains and admins can view all availabilities" ON availabilities;

-- Allow all authenticated users to view all availabilities
CREATE POLICY "All authenticated users can view availabilities"
  ON availabilities FOR SELECT TO authenticated
  USING (true);
