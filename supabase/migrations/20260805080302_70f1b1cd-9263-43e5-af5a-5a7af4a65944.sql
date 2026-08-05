CREATE TABLE IF NOT EXISTS public.receitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  codigo_acesso text NOT NULL,
  emissao_receita text,
  nome_paciente text NOT NULL,
  cpf text,
  data_nascimento text,
  endereco text,
  nome_medico text NOT NULL,
  genero_medico text NOT NULL DEFAULT 'DR',
  crm text,
  crm_uf text,
  endereco_clinica text,
  medicamentos jsonb NOT NULL DEFAULT '[]'::jsonb,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.receitas TO service_role;

ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver receitas" ON public.receitas;
CREATE POLICY "Admins podem ver receitas"
ON public.receitas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_cargo));

CREATE OR REPLACE FUNCTION public.verify_receita(_token text)
RETURNS SETOF public.receitas
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.receitas WHERE upper(token) = upper(_token) LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.verify_receita(text) TO anon, authenticated;