/*
  # Adicionar Team ID e Role Admin

  1. Mudanças na Tabela players
    - Adicionar coluna `team_id` (uuid, foreign key → teams.id)
    - Atualizar constraint de role para incluir 'admin'
    - Admins não precisam de team_id (podem gerir todas as equipas)
    - Outros roles (jogador, capitao, coordenador) precisam de team_id

  2. Mudanças na Tabela games
    - Adicionar coluna `team_id` (uuid, foreign key → teams.id)
    - Todos os jogos pertencem a uma equipa

  3. Dados Existentes
    - Criar uma equipa padrão se não existir
    - Associar todos os players e games existentes a essa equipa padrão

  4. Índices
    - Adicionar índices para team_id em players e games

  5. Notas
    - Admins têm acesso global (sem team_id)
    - Outros roles são restritos à sua equipa (com team_id)
*/

-- Criar equipa padrão se não existir
INSERT INTO teams (id, name, description, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Equipa Principal',
  'Equipa criada automaticamente durante migração',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Adicionar team_id à tabela players (temporariamente nullable)
ALTER TABLE players
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE SET NULL;

-- Associar todos os players existentes à equipa padrão
UPDATE players
SET team_id = '00000000-0000-0000-0000-000000000001'
WHERE team_id IS NULL;

-- Remover constraint antigo de role
ALTER TABLE players
DROP CONSTRAINT IF EXISTS players_role_check;

-- Adicionar novo constraint de role (incluindo admin)
ALTER TABLE players
ADD CONSTRAINT players_role_check
CHECK (role IN ('jogador', 'capitao', 'coordenador', 'admin'));

-- Adicionar team_id à tabela games (temporariamente nullable)
ALTER TABLE games
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES teams(id) ON DELETE CASCADE;

-- Associar todos os games existentes à equipa padrão
UPDATE games
SET team_id = '00000000-0000-0000-0000-000000000001'
WHERE team_id IS NULL;

-- Tornar team_id NOT NULL em games (sempre obrigatório)
ALTER TABLE games
ALTER COLUMN team_id SET NOT NULL;

-- Adicionar índices
CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_games_team_id ON games(team_id);

-- Adicionar constraint: players não-admin precisam de team_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'players_team_id_required_for_non_admin'
  ) THEN
    ALTER TABLE players
    ADD CONSTRAINT players_team_id_required_for_non_admin
    CHECK (
      (role = 'admin') OR (role != 'admin' AND team_id IS NOT NULL)
    );
  END IF;
END $$;
