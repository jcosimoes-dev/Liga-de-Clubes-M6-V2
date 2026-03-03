/*
  # Fix Trigger Functions - Disable RLS

  ## Summary
  Adiciona SECURITY DEFINER e SET row_security = off às funções dos triggers
  para evitar recursão ao consultar tabelas com políticas RLS.

  ## Problem
  As funções calculate_pair_total_points e recalculate_pair_order consultam
  as tabelas players e pairs, ativando políticas RLS que podem causar recursão.

  ## Solution
  Recriar as funções com SECURITY DEFINER e SET row_security = off.

  ## Changes
  Recria: calculate_pair_total_points, recalculate_pair_order
*/

-- ============================================================
-- TRIGGER FUNCTIONS COM RLS DESABILITADO
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_pair_total_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  player1_points integer;
  player2_points integer;
BEGIN
  -- Buscar pontos dos dois jogadores
  SELECT federation_points INTO player1_points
  FROM players
  WHERE id = NEW.player1_id;
  
  SELECT federation_points INTO player2_points
  FROM players
  WHERE id = NEW.player2_id;
  
  -- Calcular soma
  NEW.total_points := COALESCE(player1_points, 0) + COALESCE(player2_points, 0);
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION recalculate_pair_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Recalcular ordem de todas as duplas do jogo
  WITH ranked_pairs AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY total_points DESC, created_at ASC) as new_order
    FROM pairs
    WHERE game_id = COALESCE(NEW.game_id, OLD.game_id)
  )
  UPDATE pairs
  SET pair_order = ranked_pairs.new_order
  FROM ranked_pairs
  WHERE pairs.id = ranked_pairs.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;
