CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  credits_amount numeric NOT NULL DEFAULT 0,
  plan_name text,
  status text NOT NULL DEFAULT 'gerado',
  txid text,
  elitepay_charge_id text,
  pix_code text,
  qr_code_base64 text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own transactions"
ON public.financial_transactions FOR SELECT TO authenticated
USING ((auth.uid())::text = user_id);

CREATE POLICY "Admin can manage all transactions"
ON public.financial_transactions FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_cargo))
WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));

CREATE INDEX IF NOT EXISTS idx_fintx_charge ON public.financial_transactions (elitepay_charge_id);
CREATE INDEX IF NOT EXISTS idx_fintx_user ON public.financial_transactions (user_id, created_at DESC);