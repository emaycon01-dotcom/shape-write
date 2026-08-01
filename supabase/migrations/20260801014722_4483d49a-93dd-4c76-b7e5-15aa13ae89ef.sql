CREATE TABLE public.document_codes (
  code text PRIMARY KEY,
  doc_id text NOT NULL,
  doc_type text NOT NULL DEFAULT 'hapvida',
  user_id text NOT NULL,
  storage_path text NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_codes_doc ON public.document_codes(doc_id);
CREATE INDEX idx_document_codes_user ON public.document_codes(user_id);

GRANT SELECT, INSERT, UPDATE ON public.document_codes TO authenticated;
GRANT ALL ON public.document_codes TO service_role;

ALTER TABLE public.document_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can insert own codes" ON public.document_codes
  FOR INSERT TO authenticated WITH CHECK ((auth.uid())::text = user_id);
CREATE POLICY "Owner can select own codes" ON public.document_codes
  FOR SELECT TO authenticated USING ((auth.uid())::text = user_id);
CREATE POLICY "Owner can revoke own codes" ON public.document_codes
  FOR UPDATE TO authenticated USING ((auth.uid())::text = user_id) WITH CHECK ((auth.uid())::text = user_id);
CREATE POLICY "Admin can manage codes" ON public.document_codes
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_cargo)) WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));