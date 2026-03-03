/*
  Remover Unique Constraints na tabela games que causam 409 (Conflict)
  
  Executa no Supabase SQL Editor e depois tenta criar o jogo novamente.
*/

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.games'::regclass
      AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.games DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;
