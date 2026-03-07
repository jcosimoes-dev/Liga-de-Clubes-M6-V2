-- Coluna liga_points na tabela players
-- Pontos da nossa liga (10 vitória / 3 derrota) — atualizados apenas pelo botão "Recalcular Pontos".
-- federation_points fica exclusivamente manual (perfil). Total no Dashboard = liga_points + federation_points.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS liga_points integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN players.liga_points IS 'Pontos da liga M6 (10v/3d). Atualizado só pelo recálculo. Não confundir com federation_points (manual).';

-- Backfill: copiar federation_points → liga_points para não perder o histórico (até agora o sync escrevia em federation_points).
-- Após esta migração, o Recalcular Pontos passa a escrever só em liga_points; federation_points fica só manual.
UPDATE players
SET liga_points = COALESCE(federation_points, 0)
WHERE team_id IS NOT NULL;
