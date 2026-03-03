/*
  # Adicionar campo de lado preferido à tabela players

  1. Alterações
    - Adicionar coluna `preferred_side` à tabela `players`
      - Valores possíveis: 'right' (direita), 'left' (esquerda), 'both' (ambos)
      - Por defeito: 'both'
  
  2. Notas
    - Este campo indica o lado de jogo preferido do jogador
    - Usado no algoritmo de formação de pares
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'preferred_side'
  ) THEN
    ALTER TABLE players ADD COLUMN preferred_side text DEFAULT 'both' NOT NULL;
    
    -- Adicionar constraint para validar valores
    ALTER TABLE players ADD CONSTRAINT players_preferred_side_check 
      CHECK (preferred_side IN ('left', 'right', 'both'));
  END IF;
END $$;