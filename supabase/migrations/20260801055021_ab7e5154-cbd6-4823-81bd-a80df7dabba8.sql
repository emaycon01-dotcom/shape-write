CREATE OR REPLACE FUNCTION public.admin_clear_role(_target_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _target_user_id = (auth.uid())::text THEN
    RAISE EXCEPTION 'cannot_change_self';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_role(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_clear_role(text) TO authenticated;