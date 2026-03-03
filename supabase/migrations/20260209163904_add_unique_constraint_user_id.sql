/*
  # Adicionar Constraint UNIQUE em players.user_id

  1. Alterações
    - Adiciona constraint UNIQUE no campo `user_id` da tabela `players`
    - Garante que cada user_id (do auth.users) tem apenas um player
    - Previne duplicação de registos
    - Permite usar ON CONFLICT (user_id) de forma segura

  2. Segurança
    - Usa IF NOT EXISTS para evitar erro se constraint já existir
    - Operação idempotente e segura

  3. Benefícios
    - Integridade referencial garantida
    - Impossível ter múltiplos players para mesmo user_id
    - Suporta lógica de UPSERT (INSERT ... ON CONFLICT)
*/

-- Adicionar constraint UNIQUE no campo user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_user_id_unique'
  ) THEN
    ALTER TABLE public.players
    ADD CONSTRAINT players_user_id_unique UNIQUE (user_id);
  END IF;
END $$;