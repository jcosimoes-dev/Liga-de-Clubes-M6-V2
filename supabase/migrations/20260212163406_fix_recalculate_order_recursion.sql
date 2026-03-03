/*
  # Fix Recalculate Order Recursion

  ## Summary
  Previne recursão infinita no trigger recalculate_order_after_pair_change.

  ## Problem
  O trigger executa AFTER INSERT OR DELETE OR UPDATE, e a função faz UPDATE
  na tabela pairs, o que reativa o próprio trigger, causando recursão infinita.

  ## Solution
  1. Remover UPDATE do trigger (apenas INSERT e DELETE precisam recalcular ordem)
  2. OU modificar função para verificar se pair_order mudou antes de recalcular

  ## Changes
  Recria o trigger para executar apenas em INSERT e DELETE
*/

-- Drop o trigger antigo
DROP TRIGGER IF EXISTS recalculate_order_after_pair_change ON pairs;

-- Recriar trigger apenas para INSERT e DELETE
-- UPDATE não precisa recalcular ordem automaticamente
CREATE TRIGGER recalculate_order_after_pair_change
  AFTER INSERT OR DELETE ON pairs
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_pair_order();
