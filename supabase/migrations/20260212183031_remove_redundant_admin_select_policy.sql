/*
  # Remove Redundant Admin SELECT Policy on Players

  1. Problem
    - Table players has two permissive SELECT policies:
      - "Admins can view all players" (is_user_admin())
      - "All authenticated users can view all players" (true)
    - The second policy already allows all authenticated users to view all players
    - The first policy is therefore redundant

  2. Solution
    - Remove the "Admins can view all players" policy
    - Keep only "All authenticated users can view all players"
  
  3. Note
    - Other multiple permissive policies are intentional and serve different purposes:
      - Different levels of access (admin/captain vs player)
      - Special bootstrap cases
      - Own profile vs all profiles
*/

-- Remove redundant admin SELECT policy on players
DROP POLICY IF EXISTS "Admins can view all players" ON players;

-- The policy "All authenticated users can view all players" remains active
-- and covers all cases including admins
