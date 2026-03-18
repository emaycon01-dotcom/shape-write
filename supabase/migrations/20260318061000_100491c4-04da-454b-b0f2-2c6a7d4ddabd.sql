
-- Create documents table
CREATE TABLE public.documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  identification TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  additional_info TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ativo',
  user_id TEXT NOT NULL,
  pdf_url TEXT
);

-- Allow public access (auth is demo-based, not Supabase Auth)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on documents"
  ON public.documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents-pdf', 'documents-pdf', true);

-- Allow public access to storage bucket
CREATE POLICY "Allow public upload to documents-pdf"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents-pdf');

CREATE POLICY "Allow public read from documents-pdf"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents-pdf');

CREATE POLICY "Allow public update in documents-pdf"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents-pdf');
