
-- Table to store banned device fingerprints
CREATE TABLE IF NOT EXISTS public.banned_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL,
  user_id text,
  user_email text DEFAULT '',
  reason text NOT NULL DEFAULT 'Tentativa de burlar segurança',
  banned_at timestamptz NOT NULL DEFAULT now(),
  banned_by text DEFAULT 'system'
);

ALTER TABLE public.banned_devices ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage banned devices
CREATE POLICY "Admin can manage banned devices"
  ON public.banned_devices
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));

-- Create unique index on fingerprint
CREATE UNIQUE INDEX IF NOT EXISTS idx_banned_devices_fingerprint
  ON public.banned_devices (fingerprint);

-- Add security_violations counter to login_attempts for auto-ban triggers
-- We'll track violations via the existing login_attempts table with attempt_type = 'violation'
