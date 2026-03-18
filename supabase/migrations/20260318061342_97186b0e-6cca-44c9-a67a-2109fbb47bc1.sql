
-- Add expires_at column to documents table (45 days from creation)
ALTER TABLE public.documents ADD COLUMN expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '45 days');

-- Update existing documents to expire 45 days from their creation
UPDATE public.documents SET expires_at = created_at + interval '45 days';
