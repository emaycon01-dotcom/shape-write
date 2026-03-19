
-- Add a column to track when warnings were last reset
ALTER TABLE public.pix_warnings ADD COLUMN IF NOT EXISTS warning_cycle_start timestamp with time zone;
