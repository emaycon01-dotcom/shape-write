-- 1) Corrigir policies de storage (correlacionar com o objeto real)
DROP POLICY IF EXISTS "Owner can read own pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete own pdfs" ON storage.objects;

CREATE POLICY "Owner can read own pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents-pdf'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_cargo)
  )
);

CREATE POLICY "Owner can delete own pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents-pdf'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::app_cargo)
  )
);

-- 2) Revogar EXECUTE público em funções SECURITY DEFINER sensíveis
REVOKE EXECUTE ON FUNCTION public.admin_adjust_credits(text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_unban_user(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_plan(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_role(text, public.app_cargo) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_credits(numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_cargo) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_login_attempts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_credits() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_plan(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_role(text, public.app_cargo) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_cargo) TO authenticated;

-- verify_atestado permanece público (portal externo de validação)
GRANT EXECUTE ON FUNCTION public.verify_atestado(text) TO anon, authenticated;