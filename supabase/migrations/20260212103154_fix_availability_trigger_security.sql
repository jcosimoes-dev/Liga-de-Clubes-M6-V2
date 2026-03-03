/*
  # Corrigir trigger de criação de availabilities

  1. Problema
    - O trigger que cria availabilities automaticamente não tem SECURITY DEFINER
    - Isto faz com que o INSERT seja bloqueado pelas políticas RLS do utilizador
    - Quando um capitão cria um jogo, o trigger falha ao tentar criar availabilities para outros jogadores

  2. Solução
    - Adicionar SECURITY DEFINER à função do trigger
    - Desabilitar RLS durante a execução da função
    - Isto permite que o trigger crie availabilities para todos os jogadores independentemente das políticas RLS
*/

-- Recriar a função com SECURITY DEFINER e desabilitação de RLS
CREATE OR REPLACE FUNCTION create_availabilities_for_new_game()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar availability apenas para jogadores e capitães activos
  -- EXCLUIR coordenadores e admins (não jogam)
  -- SECURITY DEFINER permite que isto funcione independentemente das políticas RLS
  INSERT INTO availabilities (game_id, player_id, status)
  SELECT NEW.id, id, 'sem_resposta'
  FROM players
  WHERE is_active = true
  AND role IN ('jogador', 'capitao')
  AND team_id = NEW.team_id;
  
  RETURN NEW;
END;
$$;
