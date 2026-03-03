-- =============================================================================
-- CORRIGIR ERRO: "column games.game_date does not exist"
-- A app usa a coluna game_date; se a tua tabela games tem game_type (ou falta game_date),
-- corre ESTE script no DBeaver. Depois recarrega a plataforma.
-- =============================================================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS game_date timestamptz DEFAULT now();
