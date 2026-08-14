ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS ref text;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_user_ref_uidx
  ON public.credit_transactions(user_id, ref)
  WHERE ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_credits(
  _amount numeric,
  _reason text DEFAULT 'geracao',
  _ref text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid text := (auth.uid())::text;
  _new numeric;
  _existing numeric;
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
  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE user_id = _uid AND status = 'bloqueado'
  ) THEN
    RAISE EXCEPTION 'user_blocked';
  END IF;

  SELECT credits, lower(COALESCE(plano, ''))
    INTO _existing, _plan
    FROM public.profiles
   WHERE user_id = _uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF _ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_transactions
     WHERE user_id = _uid
       AND ref = _ref
       AND created_at > now() - interval '12 hours'
  ) THEN
    RETURN COALESCE(_existing, 0);
  END IF;

  _factor := CASE _plan
    WHEN 'dealer' THEN 0.75
    WHEN 'master' THEN 0.50
    WHEN 'diamond' THEN 0
    WHEN 'diamont' THEN 0
    WHEN 'premium' THEN 0
    ELSE 1
  END;
  _charge := round(_amount * _factor, 2);

  IF _charge <= 0 THEN
    INSERT INTO public.credit_transactions
      (user_id, actor_id, kind, amount, balance_after, reason, ref)
    VALUES
      (_uid, _uid, 'debit', 0, COALESCE(_existing, 0),
       COALESCE(_reason, 'geracao') || ' (plano ' || _plan || ' 100% off)', _ref)
    ON CONFLICT (user_id, ref) WHERE ref IS NOT NULL DO NOTHING;
    RETURN COALESCE(_existing, 0);
  END IF;

  UPDATE public.profiles
     SET credits = credits - _charge
   WHERE user_id = _uid
     AND credits >= _charge
  RETURNING credits INTO _new;

  IF _new IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  BEGIN
    INSERT INTO public.credit_transactions
      (user_id, actor_id, kind, amount, balance_after, reason, ref)
    VALUES
      (_uid, _uid, 'debit', _charge, _new, COALESCE(_reason, 'geracao'), _ref);
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.profiles
       SET credits = credits + _charge
     WHERE user_id = _uid
    RETURNING credits INTO _new;
  END;

  RETURN _new;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_credits(numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_credits(numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(numeric, text, text) TO service_role;