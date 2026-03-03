/*
  # Corrigir políticas RLS de games para usar nomes de roles corretos

  1. Problema
    - As políticas RLS verificam contra 'captain' e 'admin' (inglês)
    - Mas os roles na tabela players são 'capitao' e 'admin' (português/misto)

  2. Solução
    - Actualizar todas as políticas de games para usar os nomes corretos
    - Garantir que 'capitao' e 'admin' têm permissões de criar/actualizar jogos
*/

-- Remover políticas antigas
DROP POLICY IF EXISTS "All authenticated users can view games" ON games;
DROP POLICY IF EXISTS "Captains and admins can create games" ON games;
DROP POLICY IF EXISTS "Captains and admins can update games" ON games;
DROP POLICY IF EXISTS "Only admins can delete games" ON games;

-- Criar novas políticas com os nomes de roles correctos
CREATE POLICY "All authenticated users can view games"
  ON games FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Captains and admins can create games"
  ON games FOR INSERT TO authenticated
  WITH CHECK (get_current_user_role() IN ('capitao', 'admin'));

CREATE POLICY "Captains and admins can update games"
  ON games FOR UPDATE TO authenticated
  USING (get_current_user_role() IN ('capitao', 'admin'))
  WITH CHECK (get_current_user_role() IN ('capitao', 'admin'));

CREATE POLICY "Only admins can delete games"
  ON games FOR DELETE TO authenticated
  USING (get_current_user_role() = 'admin');
