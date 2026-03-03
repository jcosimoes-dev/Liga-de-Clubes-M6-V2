/*
  # Add profile_completed flag to players table

  1. Changes
    - Add `profile_completed` boolean column to players table
    - Default to true for existing players
    - Default to false for new players created via admin
  
  2. Purpose
    - Track if player has completed their profile on first login
    - Allow admin to create players that need to complete profile
*/

ALTER TABLE players 
ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT true;

COMMENT ON COLUMN players.profile_completed IS 'Indicates if player has completed their profile on first login';
