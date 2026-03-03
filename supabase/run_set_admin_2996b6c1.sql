/*
  Atualizar o teu perfil para role = Administrador.
  Substitui '2996b6c1-a889-44cf-8068-47cef....' pelo teu UUID completo (players.id).
  Executa no Supabase SQL Editor ou via CLI.
*/
UPDATE players
SET role = 'admin', is_admin = true
WHERE id = '2996b6c1-a889-44cf-8068-47cef....';
