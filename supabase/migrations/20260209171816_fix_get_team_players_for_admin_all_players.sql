/*
  # Corrigir RPC get_team_players_for_admin para retornar TODOS os players

  1. Alterações
    - Admin deve ver TODOS os players de TODAS as equipas
    - Remover filtro por team_id
    - Retornar todos os players activos, ordenados por nome

  2. Segurança
    - Valida que o utilizador autenticado tem role='admin'
    - Usa SECURITY DEFINER para bypass RLS
    - Apenas retorna id, name, role (não expõe dados sensíveis)

  3. Uso
    - AdminScreen usa esta função para popular dropdown de todos os players
*/

-- ============================================
-- RPC: Obter TODOS os Players (Apenas Admin)
-- ============================================
CREATE OR REPLACE FUNCTION get_team_players_for_admin()
RETURNS TABLE (
  id UUID,
  name TEXT,
  role TEXT
) AS $$
DECLARE
  admin_role TEXT;
BEGIN
  -- Validar que o utilizador autenticado é admin
  SELECT p.role INTO admin_role
  FROM players p
  WHERE p.user_id = auth.uid();

  -- Se não encontrou player ou não é admin, retornar vazio
  IF admin_role IS NULL OR admin_role != 'admin' THEN
    RETURN;
  END IF;

  -- Retornar TODOS os players activos, sem filtrar por equipa
  RETURN QUERY
  SELECT p.id, p.name, p.role
  FROM players p
  WHERE p.is_active = true
  ORDER BY p.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
