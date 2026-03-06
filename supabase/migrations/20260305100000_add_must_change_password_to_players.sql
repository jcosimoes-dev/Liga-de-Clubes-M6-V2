-- Coluna para forçar o jogador a alterar a password após reset pelo admin
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.players.must_change_password IS 'Quando true, a app mostra aviso e obriga a alterar password no perfil.';
