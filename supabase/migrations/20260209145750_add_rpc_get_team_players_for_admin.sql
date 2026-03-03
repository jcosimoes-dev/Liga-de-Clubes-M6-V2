/*
  # Adicionar RPC para Listar Players da Equipa (Admin)

  1. Função RPC
    - `get_team_players_for_admin()`: Devolve lista de players da equipa do admin
    - Valida que o utilizador autenticado tem role='admin'
    - Usa SECURITY DEFINER para bypass RLS
    - Devolve apenas {id, name, role} dos players activos da mesma equipa

  2. Segurança
    - Função valida explicitamente role='admin' do utilizador autenticado
    - Apenas devolve players da mesma equipa que o admin
    - Apenas devolve players com is_active=true
    - Não expõe dados sensíveis (email, phone, user_id)

  3. Uso
    - AdminScreen chama esta função para popular dropdown de players
*/

-- ============================================
-- RPC: Obter Players da Equipa (Apenas Admin)
-- ============================================
CREATE OR REPLACE FUNCTION get_team_players_for_admin()
RETURNS TABLE (
  id UUID,
  name TEXT,
  role TEXT
) AS $$
DECLARE
  admin_team_id UUID;
  admin_role TEXT;
BEGIN
  -- Validar que o utilizador autenticado é admin
  SELECT p.team_id, p.role INTO admin_team_id, admin_role
  FROM players p
  WHERE p.user_id = auth.uid();

  -- Se não encontrou player ou não é admin, retornar vazio
  IF admin_role IS NULL OR admin_role != 'admin' THEN
    RETURN;
  END IF;

  -- Retornar todos os players activos da mesma equipa
  RETURN QUERY
  SELECT p.id, p.name, p.role
  FROM players p
  WHERE p.team_id = admin_team_id
    AND p.is_active = true
  ORDER BY p.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_team_players_for_admin() TO authenticated;
