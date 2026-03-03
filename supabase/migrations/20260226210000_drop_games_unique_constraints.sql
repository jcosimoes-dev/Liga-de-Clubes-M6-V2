/*
  # Remover Unique Constraints na tabela games que causam 409 (Conflict)

  O erro 409 ao inserir jogos indica uma violação de UNIQUE.
  Este script remove TODAS as constraints UNIQUE em games (exceto a PRIMARY KEY).
  A PRIMARY KEY (id) permanece; apenas constraints do tipo UNIQUE são removidas.
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
