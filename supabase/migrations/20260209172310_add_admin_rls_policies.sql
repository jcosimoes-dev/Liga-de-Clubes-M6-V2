/*
  # Adicionar Políticas RLS para Admins

  1. Novas Políticas
    - `admins_select_all_players`: Admins podem ver TODOS os players (independentemente da equipa)
    - `admins_update_players`: Admins podem atualizar qualquer player (incluindo roles)

  2. Segurança
    - Valida que o utilizador autenticado tem role='admin'
    - Permite SELECT e UPDATE em todos os registos de players
    - Necessário para a funcionalidade "Gerir Funções (Roles)"

  3. Uso
    - AdminScreen precisa destas políticas para carregar todos os players no dropdown
    - AdminScreen precisa destas políticas para atualizar roles de qualquer player
*/

-- ============================================
-- Política: Admins podem ver TODOS os players
-- ============================================
CREATE POLICY "admins_select_all_players"
ON public.players
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);

-- ============================================
-- Política: Admins podem atualizar qualquer player
-- ============================================
CREATE POLICY "admins_update_players"
ON public.players
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  )
);
