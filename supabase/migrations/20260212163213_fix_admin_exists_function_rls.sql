/*
  # Fix admin_exists Function - Disable RLS

  ## Summary
  Adiciona SET row_security = off à função admin_exists() para garantir
  que não há recursão ao consultar a tabela players.

  ## Changes
  Adiciona SET row_security = off à função
*/

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM players 
    WHERE role = 'admin'
  );
$$;
