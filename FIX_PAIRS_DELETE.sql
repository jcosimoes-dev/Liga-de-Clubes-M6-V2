-- Fix RLS policy to allow captains to delete pairs
-- This enables editing pairs after they've been confirmed

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Only admins can delete pairs" ON pairs;

-- Create new policy allowing captains and admins
CREATE POLICY "Captains and admins can delete pairs"
  ON pairs FOR DELETE TO authenticated
  USING (get_current_user_role() IN ('captain', 'admin'));
