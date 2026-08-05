CREATE OR REPLACE FUNCTION public.admin_set_account_status(_target_user_id text, _status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo)
     AND public.is_admin_user(_target_user_id) THEN
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
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo)
     AND public.is_admin_user(_target_user_id) THEN
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
    IF public.is_admin_user(_target_user_id) THEN RAISE EXCEPTION 'forbidden'; END IF;
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