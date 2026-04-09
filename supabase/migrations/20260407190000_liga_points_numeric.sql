-- Pontos da liga com decimais (regulamento: 3.13, 9.38, 6.25, 1.56, etc.)
ALTER TABLE public.players
  ALTER COLUMN liga_points TYPE numeric(12, 2)
  USING round(COALESCE(liga_points, 0)::numeric, 2);

ALTER TABLE public.players
  ALTER COLUMN liga_points SET DEFAULT 0;

COMMENT ON COLUMN public.players.liga_points IS 'Pontos da liga M6 (eliminatória: vitória/derrota equipa × jogou/não jogou × resultado dupla). Atualizado pelo recálculo.';
