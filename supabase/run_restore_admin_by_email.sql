/*
  Restaurar role 'admin' a um utilizador que foi indevidamente alterado para jogador.

  Executa no Supabase SQL Editor (Dashboard → SQL Editor).
  Substitui 'TEU_EMAIL@exemplo.pt' pelo email do administrador principal.

  Regras da app (após migração 20260307110000):
  - Novos utilizadores => role 'jogador'.
  - admin/coordenador/capitao existentes nunca são rebaixados por upsert/sync.
  - Promoção para capitao/coordenador/admin é manual (Admin ou Equipa).
*/

-- Restaurar admin por email (executa uma vez)
UPDATE public.players
SET role = 'admin'
WHERE LOWER(TRIM(email)) = LOWER(TRIM('TEU_EMAIL@exemplo.pt'))
  AND role IN ('jogador', 'player');

-- Verificar (opcional)
-- SELECT id, name, email, role FROM public.players WHERE LOWER(TRIM(email)) = LOWER(TRIM('TEU_EMAIL@exemplo.pt'));
