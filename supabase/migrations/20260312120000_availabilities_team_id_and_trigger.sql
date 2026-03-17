/*
  Corrige o erro: null value in column "team_id" of relation "convocations"/"availabilities".
  - Adiciona coluna team_id à tabela availabilities (se não existir).
  - Atualiza o trigger para incluir team_id no INSERT (e só corre quando o jogo tem equipa).
  - Se existir tabela "convocations" com team_id NOT NULL, aplica a mesma lógica.
*/

-- 1) availabilities: adicionar team_id se não existir
ALTER TABLE public.availabilities
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- 2) Trigger: incluir team_id e só criar registos quando o jogo tem equipa
CREATE OR REPLACE FUNCTION public.create_availabilities_for_new_game()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.team_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.availabilities (game_id, player_id, status, team_id)
  SELECT NEW.id, p.id, 'undecided', NEW.team_id
  FROM public.players p
  WHERE p.is_active = true
    AND p.role IN ('capitao', 'jogador', 'captain', 'player')
    AND p.team_id = NEW.team_id;
  RETURN NEW;
END;
$$;

