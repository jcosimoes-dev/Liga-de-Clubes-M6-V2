-- Executar no SQL Editor do Supabase (projeto ligado) se o recálculo falhar com:
-- invalid input syntax for type integer: "3.13"
--
-- Isto alinha com: supabase/migrations/20260407190000_liga_points_numeric.sql

ALTER TABLE public.players
  ALTER COLUMN liga_points TYPE numeric(12, 2)
  USING round(COALESCE(liga_points, 0)::numeric, 2);

ALTER TABLE public.players
  ALTER COLUMN liga_points SET DEFAULT 0;

COMMENT ON COLUMN public.players.liga_points IS 'Pontos da liga M6 (eliminatória; decimais). Atualizado pelo recálculo.';
