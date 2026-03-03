-- Correr ESTE script UMA VEZ se der erro "policy already exists" no script 01_games.
-- Depois correr run_in_dbeaver_01_games.sql

DROP POLICY IF EXISTS "Authenticated users can view all games" ON games;
DROP POLICY IF EXISTS "Captains can insert games" ON games;
DROP POLICY IF EXISTS "Captains can update games" ON games;
DROP POLICY IF EXISTS "Captains can delete games" ON games;
