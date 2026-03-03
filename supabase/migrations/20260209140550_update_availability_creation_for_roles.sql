/*
  # Atualizar Criação de Availabilities para Considerar Roles

  1. Mudanças
    - Atualizar função `create_availabilities_for_new_game()` para criar availabilities apenas para:
      - Jogadores com role = 'jogador'
      - Jogadores com role = 'capitao' (capitães também jogam)
    - EXCLUIR coordenadores (role = 'coordenador') da criação automática de availabilities

  2. Impacto
    - Quando um novo jogo é criado, availabilities são criadas apenas para jogadores e capitães ativos
    - Coordenadores NÃO recebem availabilities automaticamente (não jogam)

  3. Notas
    - Mantém filtro is_active = true (jogadores devem estar ativos)
    - Coordenadores podem ser adicionados manualmente se necessário (via Admin)
*/

-- Atualizar função para criar availabilities apenas para jogadores e capitães
CREATE OR REPLACE FUNCTION create_availabilities_for_new_game()
RETURNS TRIGGER AS $$
BEGIN
  -- Criar availability apenas para jogadores e capitães ativos
  -- EXCLUIR coordenadores (não jogam)
  INSERT INTO availabilities (game_id, player_id, status)
  SELECT NEW.id, id, 'sem_resposta'
  FROM players
  WHERE is_active = true
  AND role IN ('jogador', 'capitao');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
