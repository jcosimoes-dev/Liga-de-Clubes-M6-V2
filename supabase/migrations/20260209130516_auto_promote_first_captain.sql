/*
  # Bootstrap do Primeiro Capitão
  
  1. Função e Trigger
    - Função que verifica se é o primeiro jogador
    - Se for o primeiro (count = 0), marca is_captain = true automaticamente
    - Trigger executa antes de cada INSERT na tabela players
  
  2. Objetivo
    - Eliminar necessidade de promoção manual do primeiro capitão
    - Primeiro utilizador a registar-se torna-se capitão automaticamente
*/

-- Função para promover o primeiro jogador a capitão
CREATE OR REPLACE FUNCTION promote_first_captain()
RETURNS TRIGGER AS $$
BEGIN
  -- Contar jogadores existentes (excluindo o que está a ser inserido)
  IF (SELECT COUNT(*) FROM players) = 0 THEN
    -- Se é o primeiro, marcar como capitão
    NEW.is_captain := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger antes de inserir um novo jogador
DROP TRIGGER IF EXISTS trigger_promote_first_captain ON players;
CREATE TRIGGER trigger_promote_first_captain
  BEFORE INSERT ON players
  FOR EACH ROW
  EXECUTE FUNCTION promote_first_captain();
