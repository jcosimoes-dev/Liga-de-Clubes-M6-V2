-- =============================================================================
-- Diagnóstico e correção de Foreign Keys na tabela pairs (erro 500 fkey)
-- Executar no SQL Editor do Supabase.
--
-- 1. Verificar colunas e FKs: player1_id e player2_id devem ser UUID e referir
--    public.players(id). game_id deve referir public.games(id).
-- 2. Garantir ON DELETE CASCADE nas FKs para evitar bloqueios.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PARTE 1: Diagnóstico (apenas consultas, não altera nada)
-- -----------------------------------------------------------------------------
-- Estrutura das colunas da tabela pairs (tipos e nullability):
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pairs'
ORDER BY ordinal_position;

-- FKs da tabela pairs (tabela referenciada e coluna):
SELECT
  tc.constraint_name,
  tc.table_schema || '.' || tc.table_name AS tabela,
  kcu.column_name,
  ccu.table_schema || '.' || ccu.table_name AS referenciada,
  ccu.column_name AS coluna_referenciada,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public' AND tc.table_name = 'pairs';

-- -----------------------------------------------------------------------------
-- PARTE 2: Corrigir FKs para ON DELETE CASCADE (se ainda não estiverem)
-- Nota: Só executar se o diagnóstico mostrar delete_rule diferente de CASCADE.
-- -----------------------------------------------------------------------------
-- Remover FKs antigas e recriar com ON DELETE CASCADE (nomes típicos do Postgres)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'pairs' AND constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE format('ALTER TABLE public.pairs DROP CONSTRAINT IF EXISTS %I', r.constraint_name);
  END LOOP;
END $$;

-- Recriar FKs apontando para public.games e public.players (UUID)
ALTER TABLE public.pairs
  ADD CONSTRAINT pairs_game_id_fkey
  FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;

ALTER TABLE public.pairs
  ADD CONSTRAINT pairs_player1_id_fkey
  FOREIGN KEY (player1_id) REFERENCES public.players(id) ON DELETE CASCADE;

ALTER TABLE public.pairs
  ADD CONSTRAINT pairs_player2_id_fkey
  FOREIGN KEY (player2_id) REFERENCES public.players(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- Verificação final: os IDs que envias (game_id, player1_id, player2_id) devem
-- existir em public.games(id) e public.players(id). NUNCA usar auth.users(id).
-- -----------------------------------------------------------------------------
