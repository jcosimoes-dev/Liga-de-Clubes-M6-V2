/*
  # Fix ALL Helper Functions - Final RLS Disable (Corrected)

  ## Summary
  Garante que TODAS as funções helper que consultam a tabela players
  têm SET row_security = off para evitar qualquer recursão.

  ## Changes
  Recria todas as funções helper existentes com SET row_security = off
*/

-- ============================================================
-- Verificar e corrigir TODAS as funções helper
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_team_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT team_id FROM players
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION has_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_admin()
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
  );
$$;

CREATE OR REPLACE FUNCTION is_admin_bypass()
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
  );
$$;

CREATE OR REPLACE FUNCTION is_team_captain()
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
  );
$$;

-- Função para obter jogadores de uma equipa (para RPCs)
CREATE OR REPLACE FUNCTION get_team_players(team_id_param UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  federation_points INTEGER,
  preferred_side TEXT,
  is_active BOOLEAN,
  role TEXT,
  team_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT 
    id, user_id, name, email, phone, 
    federation_points, preferred_side, is_active, 
    role, team_id, created_at, updated_at
  FROM players
  WHERE players.team_id = team_id_param
  ORDER BY name;
$$;

-- Função para admin obter todos os jogadores de uma equipa
CREATE OR REPLACE FUNCTION get_team_players_for_admin(team_id_param UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  email TEXT,
  phone TEXT,
  federation_points INTEGER,
  preferred_side TEXT,
  is_active BOOLEAN,
  role TEXT,
  team_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  -- Verificar se o utilizador é admin
  IF NOT is_user_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem aceder a esta função';
  END IF;

  -- Retornar todos os jogadores da equipa
  RETURN QUERY
  SELECT 
    p.id, p.user_id, p.name, p.email, p.phone,
    p.federation_points, p.preferred_side, p.is_active,
    p.role, p.team_id, p.created_at, p.updated_at
  FROM players p
  WHERE p.team_id = team_id_param
  ORDER BY p.name;
END;
$$;
