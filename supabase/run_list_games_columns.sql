/*
  Listar colunas da tabela games — para identificar o esquema real.
  Executa no Supabase SQL Editor.
*/

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'games'
ORDER BY ordinal_position;
