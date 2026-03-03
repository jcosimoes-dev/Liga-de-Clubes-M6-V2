/*
  # Fix Helper Functions - Disable RLS

  ## Summary
  Adiciona SET row_security = off a todas as funções helper para garantir
  que não haja recursão ao consultar a tabela players.

  ## Problem
  As funções helper consultam a tabela players, mas se RLS estiver ativo
  durante a consulta, pode haver recursão infinita.

  ## Solution
  Adicionar SET row_security = off a todas as funções helper.

  ## Changes
  Recria funções: is_user_admin, is_user_captain, is_user_captain_or_admin, user_owns_pair
*/

-- ============================================================
-- HELPER FUNCTIONS COM RLS DESABILITADO
-- ============================================================

CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE user_id = auth.uid()
    AND role = 'admin'
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION is_user_captain()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE user_id = auth.uid()
    AND role = 'capitao'
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION is_user_captain_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE user_id = auth.uid()
    AND role IN ('capitao', 'admin')
    LIMIT 1
  );
$$;

CREATE OR REPLACE FUNCTION user_owns_pair(pair_player1_id UUID, pair_player2_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  current_player_id UUID;
BEGIN
  SELECT id INTO current_player_id
  FROM players
  WHERE user_id = auth.uid()
  LIMIT 1;
  
  RETURN (pair_player1_id = current_player_id OR pair_player2_id = current_player_id);
END;
$$;
