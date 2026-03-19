
-- Create a function to prevent non-admin users from modifying credits or plano
CREATE OR REPLACE FUNCTION public.protect_profile_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Allow if caller is admin
  IF public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RETURN NEW;
  END IF;

  -- Block changes to credits or plano for non-admin users
  IF NEW.credits IS DISTINCT FROM OLD.credits THEN
    RAISE EXCEPTION 'Only administrators can modify credits';
  END IF;

  IF NEW.plano IS DISTINCT FROM OLD.plano THEN
    RAISE EXCEPTION 'Only administrators can modify plan';
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER protect_profile_credits_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_credits();
