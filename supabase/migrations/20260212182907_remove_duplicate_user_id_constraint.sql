/*
  # Remove Duplicate Constraint on players table

  1. Problem
    - Table players has duplicate unique constraints on user_id
    - players_user_id_key and players_user_id_unique serve the same purpose
  
  2. Solution
    - Drop the constraint players_user_id_key (which also drops its index)
    - Keep players_user_id_unique as it's more descriptive
*/

-- Drop the duplicate constraint (this will also drop the associated index)
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_user_id_key;
