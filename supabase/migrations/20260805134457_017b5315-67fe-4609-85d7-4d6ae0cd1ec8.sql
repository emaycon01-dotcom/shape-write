CREATE TABLE public.staff_credit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  actor_name text NOT NULL DEFAULT '',
  actor_email text NOT NULL DEFAULT '',
  actor_cargo text NOT NULL DEFAULT '',
  target_user_id text NOT NULL,
  target_name text NOT NULL DEFAULT '',
  target_email text NOT NULL DEFAULT '',
  delta numeric NOT NULL,
  balance_after numeric NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.staff_credit_logs TO authenticated;
GRANT ALL ON public.staff_credit_logs TO service_role;

ALTER TABLE public.staff_credit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view staff credit logs"
ON public.staff_credit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_cargo));

CREATE INDEX staff_credit_logs_created_at_idx ON public.staff_credit_logs (created_at DESC);

CREATE OR REPLACE FUNCTION public.staff_adjust_credits(_target_user_id text, _delta numeric, _reason text DEFAULT ''::text)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _actor text := (auth.uid())::text;
  _is_admin boolean := public.has_role(auth.uid(), 'admin'::app_cargo);
  _is_gerente boolean := public.has_role(auth.uid(), 'gerente'::app_cargo);
  _actor_p record;
  _target_p record;
  _new numeric;
BEGIN
  IF _actor IS NULL OR NOT (_is_admin OR _is_gerente) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _delta IS NULL OR _delta = 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF _is_admin THEN
    IF abs(_delta) > 1000000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  ELSE
    IF abs(_delta) > 5 THEN RAISE EXCEPTION 'limit_exceeded'; END IF;
    IF _target_user_id = _actor THEN RAISE EXCEPTION 'cannot_change_self'; END IF;
  END IF;

  SELECT name, email INTO _actor_p FROM public.profiles WHERE user_id = _actor;
  SELECT name, email INTO _target_p FROM public.profiles WHERE user_id = _target_user_id;
  IF _target_p IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  PERFORM set_config('app.credit_op', '1', true);
  UPDATE public.profiles
     SET credits = GREATEST(0, credits + _delta)
   WHERE user_id = _target_user_id
  RETURNING credits INTO _new;
  PERFORM set_config('app.credit_op', '0', true);

  IF _new IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
  VALUES (_target_user_id, _actor,
          CASE WHEN _delta > 0 THEN 'admin_credit' ELSE 'admin_debit' END,
          abs(_delta), _new, COALESCE(_reason, ''));

  INSERT INTO public.staff_credit_logs(
    actor_id, actor_name, actor_email, actor_cargo,
    target_user_id, target_name, target_email,
    delta, balance_after, reason)
  VALUES (_actor, COALESCE(_actor_p.name,''), COALESCE(_actor_p.email,''),
          CASE WHEN _is_admin THEN 'admin' ELSE 'gerente' END,
          _target_user_id, COALESCE(_target_p.name,''), COALESCE(_target_p.email,''),
          _delta, _new, COALESCE(_reason, ''));

  RETURN _new;
END;
$function$;