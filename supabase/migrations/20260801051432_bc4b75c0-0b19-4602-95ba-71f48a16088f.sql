ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by text;

-- Contas já aprovadas hoje seguem funcionando normalmente
UPDATE public.profiles SET verified = true, verified_at = now() WHERE status = 'aprovado';

CREATE OR REPLACE FUNCTION public.protect_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.status_op', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Only administrators can modify account status';
  END IF;
  IF NEW.verified IS DISTINCT FROM OLD.verified THEN
    RAISE EXCEPTION 'Only staff can modify account verification';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_verified(_target_user_id text, _verified boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  PERFORM set_config('app.status_op', '1', true);
  UPDATE public.profiles
     SET verified = _verified,
         verified_at = CASE WHEN _verified THEN now() ELSE NULL END,
         verified_by = CASE WHEN _verified THEN (auth.uid())::text ELSE NULL END
   WHERE user_id = _target_user_id;
  PERFORM set_config('app.status_op', '0', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_verified(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_verified(text, boolean) TO authenticated, service_role;