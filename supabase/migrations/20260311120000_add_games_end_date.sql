/*
  Torneios de vários dias (ex: Torneio da Páscoa).
  Coluna end_date (date, opcional): quando preenchida, o evento é tratado como intervalo [starts_at .. end_date].
*/

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS end_date date;

COMMENT ON COLUMN public.games.end_date IS 'Data de fim (opcional). Se preenchida, o evento é multi-dia (ex: torneio).';
