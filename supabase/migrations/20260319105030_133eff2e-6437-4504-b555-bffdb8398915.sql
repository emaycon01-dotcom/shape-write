
-- Add PIN hash column to profiles (stored as bcrypt hash, never plain text)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_hash text DEFAULT NULL;

-- Create login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  attempt_type text NOT NULL DEFAULT 'login',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Only service role can manage login_attempts (no user access)
-- No policies = no user access by default with RLS enabled

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_created 
  ON public.login_attempts (identifier, created_at DESC);

-- Auto-cleanup old attempts (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  DELETE FROM public.login_attempts WHERE created_at < now() - interval '1 hour';
$$;
