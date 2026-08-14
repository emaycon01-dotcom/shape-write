ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS gateway text DEFAULT 'elitepay',
  ADD COLUMN IF NOT EXISTS gateway_charge_id text;

UPDATE public.financial_transactions
SET gateway_charge_id = elitepay_charge_id
WHERE gateway_charge_id IS NULL AND elitepay_charge_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_paid_financial_transaction(_transaction_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _tx public.financial_transactions%ROWTYPE;
  _balance numeric;
  _plan_value text;
  _profile_name text;
  _profile_email text;
  _gateway text;
  _charge_ref text;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _tx
  FROM public.financial_transactions
  WHERE id = _transaction_id
  FOR UPDATE;

  IF NOT FOUND OR _tx.status = 'pago' THEN
    RETURN false;
  END IF;

  _gateway := COALESCE(_tx.gateway, 'elitepay');
  _charge_ref := COALESCE(_tx.gateway_charge_id, _tx.elitepay_charge_id, '');

  IF _tx.type = 'credito' AND COALESCE(_tx.credits_amount, 0) > 0 THEN
    UPDATE public.profiles
    SET credits = COALESCE(credits, 0) + _tx.credits_amount
    WHERE user_id = _tx.user_id
    RETURNING credits, name, email INTO _balance, _profile_name, _profile_email;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'profile_not_found';
    END IF;

    INSERT INTO public.credit_transactions
      (user_id, actor_id, kind, amount, balance_after, reason)
    VALUES
      (_tx.user_id, 'system', 'credit', _tx.credits_amount, _balance,
       trim('pix_' || _gateway || ' ' || _charge_ref));
  ELSIF _tx.type = 'plano' AND _tx.plan_name IS NOT NULL THEN
    _plan_value := CASE _tx.plan_name
      WHEN 'Basic' THEN 'dealer'
      WHEN 'Pro' THEN 'master'
      WHEN 'Premium' THEN 'diamond'
      ELSE lower(_tx.plan_name)
    END;

    UPDATE public.profiles
    SET plano = _plan_value
    WHERE user_id = _tx.user_id
    RETURNING name, email INTO _profile_name, _profile_email;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'profile_not_found';
    END IF;

    INSERT INTO public.user_roles (user_id, cargo, assigned_by)
    VALUES (_tx.user_id, _plan_value::public.app_cargo, 'system')
    ON CONFLICT (user_id, cargo) DO UPDATE SET assigned_by = EXCLUDED.assigned_by;
  ELSE
    RAISE EXCEPTION 'invalid_transaction';
  END IF;

  UPDATE public.pix_warnings
  SET status = 'cleared', resolved_at = now()
  WHERE user_id = _tx.user_id
    AND status IN ('warning', 'pending');

  IF _profile_name IS NULL AND _profile_email IS NULL THEN
    SELECT name, email INTO _profile_name, _profile_email
    FROM public.profiles
    WHERE user_id = _tx.user_id;
  END IF;

  INSERT INTO public.deposits
    (user_id, user_name, user_email, amount, method, status)
  VALUES
    (_tx.user_id, COALESCE(_profile_name, ''), COALESCE(_profile_email, ''),
     _tx.amount, 'pix_' || _gateway, 'completed');

  UPDATE public.financial_transactions
  SET status = 'pago', paid_at = now()
  WHERE id = _tx.id;

  RETURN true;
END;
$function$;

GRANT UPDATE, INSERT, SELECT, DELETE ON public.financial_transactions TO authenticated;
GRANT ALL ON public.financial_transactions TO service_role;
