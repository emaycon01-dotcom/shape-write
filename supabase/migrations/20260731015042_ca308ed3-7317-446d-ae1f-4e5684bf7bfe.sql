-- 1) Storage: remove public + non-owner policies
DROP POLICY IF EXISTS "Allow public upload to documents-pdf" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read from documents-pdf" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update in documents-pdf" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can upload to documents-pdf" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can read from documents-pdf" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update in documents-pdf" ON storage.objects;

CREATE POLICY "Owner can read own pdfs" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents-pdf' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.documents d WHERE d.id = split_part(name, '.', 1) AND d.user_id = (auth.uid())::text)
    OR public.has_role(auth.uid(), 'admin'::app_cargo)
  )
);

CREATE POLICY "Owner can upload own pdfs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents-pdf' AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Owner can update own pdfs" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents-pdf' AND (storage.foldername(name))[1] = (auth.uid())::text
)
WITH CHECK (
  bucket_id = 'documents-pdf' AND (storage.foldername(name))[1] = (auth.uid())::text
);

CREATE POLICY "Owner can delete own pdfs" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents-pdf' AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR EXISTS (SELECT 1 FROM public.documents d WHERE d.id = split_part(name, '.', 1) AND d.user_id = (auth.uid())::text)
    OR public.has_role(auth.uid(), 'admin'::app_cargo)
  )
);

-- 2) Hide pin_hash from clients at the column-privilege level
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, user_id, name, email, credits, plano, created_at) ON public.profiles TO authenticated;

-- 3) Lock down SECURITY DEFINER functions to authenticated only
REVOKE EXECUTE ON FUNCTION public.consume_credits(numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_plan(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(text, app_cargo) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_unban_user(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_cargo) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_login_attempts() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_credits(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_plan(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(text, app_cargo) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_cargo) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_login_attempts() TO service_role;