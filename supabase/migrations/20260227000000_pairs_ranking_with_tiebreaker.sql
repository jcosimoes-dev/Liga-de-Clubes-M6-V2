/*
  # Ranking de Duplas (pair_order 1, 2, 3)

  Após o coordenador definir as 3 duplas:
  - Dupla 1: Maior soma total (total_points)
  - Dupla 3: Menor soma total
  - Dupla 2: Soma intermédia
  - Desempate: Se soma igual, a dupla com o jogador de maior ranking individual assume posição superior.
  - Usa dense_rank() para precisão.
*/

CREATE OR REPLACE FUNCTION public.recalculate_pair_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  WITH pair_sums AS (
    SELECT
      p.id,
      p.total_points,
      GREATEST(
        COALESCE((SELECT federation_points FROM players WHERE id = p.player1_id), 0),
        COALESCE((SELECT federation_points FROM players WHERE id = p.player2_id), 0)
      ) AS max_player_points,
      p.created_at
    FROM pairs p
    WHERE p.game_id = COALESCE(NEW.game_id, OLD.game_id)
  ),
  ranked AS (
    SELECT
      id,
      dense_rank() OVER (
        ORDER BY total_points DESC, max_player_points DESC, created_at ASC
      ) AS new_order
    FROM pair_sums
  )
  UPDATE pairs
  SET pair_order = ranked.new_order
  FROM ranked
  WHERE pairs.id = ranked.id;

  RETURN COALESCE(NEW, OLD);
END;
$$;
