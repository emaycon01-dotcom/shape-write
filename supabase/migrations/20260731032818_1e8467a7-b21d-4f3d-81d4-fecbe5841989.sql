CREATE TABLE public.template_alignments (
  doc_type TEXT PRIMARY KEY,
  positions JSONB NOT NULL,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.template_alignments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.template_alignments TO authenticated;
GRANT ALL ON public.template_alignments TO service_role;

ALTER TABLE public.template_alignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logged users can read alignments"
  ON public.template_alignments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage alignments"
  ON public.template_alignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));