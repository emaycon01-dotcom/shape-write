
-- Table to track PIX QR code warnings
CREATE TABLE public.pix_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  qr_code_id text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_at timestamp with time zone
);

ALTER TABLE public.pix_warnings ENABLE ROW LEVEL SECURITY;

-- Users can see their own warnings
CREATE POLICY "Owner can select own warnings"
  ON public.pix_warnings FOR SELECT TO authenticated
  USING ((auth.uid())::text = user_id);

-- Users can insert their own warnings
CREATE POLICY "Owner can insert own warnings"
  ON public.pix_warnings FOR INSERT TO authenticated
  WITH CHECK ((auth.uid())::text = user_id);

-- Users can update their own warnings (to mark as paid)
CREATE POLICY "Owner can update own warnings"
  ON public.pix_warnings FOR UPDATE TO authenticated
  USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

-- Admin can manage all
CREATE POLICY "Admin can manage all warnings"
  ON public.pix_warnings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
