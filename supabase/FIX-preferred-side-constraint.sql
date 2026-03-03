-- ============================================================
-- CORREÇÃO: constraint players_preferred_side_check
-- ============================================================
-- Executa isto UMA VEZ no Supabase Dashboard:
--   1. Abre https://supabase.com/dashboard → teu projeto
--   2. Menu lateral: SQL Editor
--   3. New query → cola o código abaixo → Run
-- ============================================================

ALTER TABLE players
  DROP CONSTRAINT IF EXISTS players_preferred_side_check;

ALTER TABLE players
  ADD CONSTRAINT players_preferred_side_check
  CHECK (preferred_side IN ('left', 'right', 'both'));
