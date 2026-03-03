/*
  # Corrigir função update_updated_at_column com SECURITY DEFINER
  
  1. Problema
    - A função update_updated_at_column() não tem SECURITY DEFINER
    - Isto pode causar problemas quando jogadores normais tentam atualizar registos
    - A função precisa de executar com privilégios elevados para atualizar o campo updated_at
  
  2. Solução
    - Recriar a função com SECURITY DEFINER
    - Isto permite que o trigger execute independentemente das políticas RLS
    - Garante que todos os utilizadores possam atualizar os seus próprios registos
*/

-- Recriar a função com SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Garantir que a função pode ser executada por utilizadores autenticados
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated;
