CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Operações internas autorizadas (RPCs de staff/admin) e service_role.
  IF current_setting('app.status_op', true) = '1'
     OR current_setting('app.credit_op', true) = '1'
     OR auth.uid() IS NULL
     OR public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RETURN NEW;
  END IF;

  IF NEW.plano IS DISTINCT FROM OLD.plano
     OR NEW.credits IS DISTINCT FROM OLD.credits
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'not_allowed_to_modify_privileged_fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns_trg ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();