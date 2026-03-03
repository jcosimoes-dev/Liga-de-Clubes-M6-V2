/*
  # Atualizar Fases dos Jogos

  1. Mudanças
    - Atualizar valores existentes de fase:
      - "Regular" → "Qualificação"
      - "Play-off" → "Regionais"
      - "Final" → "Nacionais"
    - Adicionar constraint CHECK para validar apenas as novas fases

  2. Impacto
    - Jogos existentes terão as suas fases atualizadas automaticamente
    - Novos jogos só poderão usar as novas fases: Qualificação, Regionais, Nacionais

  3. Notas
    - Migração segura: valores antigos são preservados através do mapeamento
    - Constraint garante consistência de dados futura
*/

-- Atualizar valores existentes para as novas fases
UPDATE games 
SET phase = 'Qualificação' 
WHERE phase = 'Regular';

UPDATE games 
SET phase = 'Regionais' 
WHERE phase = 'Play-off';

UPDATE games 
SET phase = 'Nacionais' 
WHERE phase = 'Final';

-- Adicionar constraint CHECK para validar apenas as novas fases
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'games_phase_check'
  ) THEN
    ALTER TABLE games
    ADD CONSTRAINT games_phase_check
    CHECK (phase IN ('Qualificação', 'Regionais', 'Nacionais'));
  END IF;
END $$;
