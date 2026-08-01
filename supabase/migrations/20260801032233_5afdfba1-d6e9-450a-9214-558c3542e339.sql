ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text;

UPDATE public.profiles SET status = 'aprovado', approved_at = now() WHERE status = 'pendente';

CREATE OR REPLACE FUNCTION public.protect_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_status_trg ON public.profiles;
CREATE TRIGGER protect_profile_status_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_status();

CREATE OR REPLACE FUNCTION public.admin_set_account_status(_target_user_id text, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('pendente','aprovado','rejeitado') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  PERFORM set_config('app.status_op', '1', true);
  UPDATE public.profiles
     SET status = _status,
         approved_at = CASE WHEN _status = 'aprovado' THEN now() ELSE NULL END,
         approved_by = (auth.uid())::text
   WHERE user_id = _target_user_id;
  PERFORM set_config('app.status_op', '0', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_profile_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_account_status(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(text, text) TO authenticated;