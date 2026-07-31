CREATE OR REPLACE FUNCTION public.consume_credits(_amount numeric, _reason text DEFAULT 'geracao'::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid text := (auth.uid())::text;
  _new numeric;
  _plan text;
  _factor numeric := 1;
  _charge numeric;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 100 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blocked_users WHERE user_id = _uid AND status = 'bloqueado') THEN
    RAISE EXCEPTION 'user_blocked';
  END IF;

  SELECT plano INTO _plan FROM public.profiles WHERE user_id = _uid;
  IF _plan IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  _factor := CASE _plan
    WHEN 'dealer' THEN 0.75
    WHEN 'master' THEN 0.5
    WHEN 'diamond' THEN 0
    ELSE 1
  END;

  _charge := round(_amount * _factor, 2);

  IF _charge <= 0 THEN
    SELECT credits INTO _new FROM public.profiles WHERE user_id = _uid;
    INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
    VALUES (_uid, _uid, 'debit', 0, _new, COALESCE(_reason, 'geracao') || ' (plano ' || _plan || ' 100% off)');
    RETURN _new;
  END IF;

  UPDATE public.profiles
     SET credits = credits - _charge
   WHERE user_id = _uid
     AND credits >= _charge
  RETURNING credits INTO _new;

  IF _new IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
  VALUES (_uid, _uid, 'debit', _charge, _new, COALESCE(_reason, 'geracao'));

  RETURN _new;
END;
$function$;