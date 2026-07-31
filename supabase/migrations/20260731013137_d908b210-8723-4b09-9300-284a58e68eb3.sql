CREATE OR REPLACE FUNCTION public.protect_profile_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Backend/system operations (service role, e.g. confirmação de pagamento PIX)
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR current_setting('role', true) = 'service_role'
     OR session_user = 'service_role'
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RETURN NEW;
  END IF;

  IF NEW.credits IS DISTINCT FROM OLD.credits THEN
    RAISE EXCEPTION 'Only administrators can modify credits';
  END IF;

  IF NEW.plano IS DISTINCT FROM OLD.plano THEN
    RAISE EXCEPTION 'Only administrators can modify plan';
  END IF;

  RETURN NEW;
END;
$function$;