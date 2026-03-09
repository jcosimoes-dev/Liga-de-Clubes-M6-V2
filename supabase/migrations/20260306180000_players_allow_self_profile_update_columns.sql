/*
  # Permitir atualização de perfil próprio (campos editáveis) sem erro "Sem permissão para alterar estes campos"

  - Remove triggers que possam bloquear o update com essa mensagem (se existirem no projeto).
  - Adiciona trigger que, para utilizadores não-admin/gestor, repõe colunas protegidas ao valor antigo
    em vez de bloquear, permitindo que name, phone, preferred_side, federation_points, is_active, must_change_password
    sejam atualizados normalmente.
*/

-- Remover triggers que possam estar a levantar "Sem permissão para alterar estes campos do jogador"
DROP TRIGGER IF EXISTS check_players_update_fields ON players;
DROP TRIGGER IF EXISTS players_check_update_allowed ON players;
DROP TRIGGER IF EXISTS validate_players_update ON players;

-- Função: para não-admin/gestor, repor colunas protegidas ao valor antigo (sanitizar) em vez de bloquear
CREATE OR REPLACE FUNCTION public.players_sanitize_restricted_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin e gestor podem alterar qualquer coluna
  IF public.is_admin_or_gestor_bypass() THEN
    RETURN NEW;
  END IF;

  -- Utilizador normal: manter colunas protegidas iguais ao valor antigo (updated_at será atualizado pelo trigger update_players_updated_at)
  NEW.id := OLD.id;
  NEW.user_id := OLD.user_id;
  NEW.role := OLD.role;
  NEW.email := OLD.email;
  NEW.created_at := OLD.created_at;
  NEW.team_id := OLD.team_id;
  NEW.liga_points := OLD.liga_points;
  NEW.points_updated_at := OLD.points_updated_at;
  NEW.profile_completed := OLD.profile_completed;

  RETURN NEW;
END;
$$;

-- Trigger BEFORE UPDATE: executa antes de update_players_updated_at para sanitizar primeiro
DROP TRIGGER IF EXISTS players_sanitize_restricted_columns ON players;
CREATE TRIGGER players_sanitize_restricted_columns
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION public.players_sanitize_restricted_columns();

COMMENT ON FUNCTION public.players_sanitize_restricted_columns() IS 'Para utilizadores não-admin/gestor, repõe id, user_id, role, email, created_at, updated_at, team_id, liga_points, points_updated_at, profile_completed ao valor antigo, permitindo que name, phone, preferred_side, federation_points, is_active, must_change_password sejam atualizados.';
