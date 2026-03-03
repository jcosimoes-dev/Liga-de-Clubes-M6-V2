/*
  # Add Admin INSERT Policy for Players Table

  ## Problem
  Admins cannot create test users because there's no RLS policy allowing
  admins to insert players with different user_ids.

  ## Solution
  Add an INSERT policy that allows admins to create players for any user_id.

  ## Changes
  - Create policy: "Admins can insert any player"
*/

-- Allow admins to insert players for any user_id
CREATE POLICY "Admins can insert any player"
  ON players
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());
