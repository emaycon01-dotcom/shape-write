
-- 1) Ledger de créditos
CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  actor_id text,
  kind text NOT NULL DEFAULT 'debit',
  amount numeric NOT NULL DEFAULT 0,
  balance_after numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can select own credit transactions" ON public.credit_transactions;
CREATE POLICY "Owner can select own credit transactions"
  ON public.credit_transactions FOR SELECT TO authenticated
  USING ((auth.uid())::text = user_id);

DROP POLICY IF EXISTS "Admin can manage credit transactions" ON public.credit_transactions;
CREATE POLICY "Admin can manage credit transactions"
  ON public.credit_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_cargo));

CREATE INDEX IF NOT EXISTS credit_transactions_user_idx ON public.credit_transactions(user_id, created_at DESC);

-- 2) Ativar trigger de proteção de créditos/plano (estava criado mas nunca anexado)
DROP TRIGGER IF EXISTS protect_profile_credits_trg ON public.profiles;
CREATE TRIGGER protect_profile_credits_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_credits();

-- 3) Consumo atômico de créditos
CREATE OR REPLACE FUNCTION public.consume_credits(_amount numeric, _reason text DEFAULT 'geracao')
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid text := (auth.uid())::text;
  _new numeric;
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

  UPDATE public.profiles
     SET credits = credits - _amount
   WHERE user_id = _uid
     AND credits >= _amount
  RETURNING credits INTO _new;

  IF _new IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
  VALUES (_uid, _uid, 'debit', _amount, _new, COALESCE(_reason, 'geracao'));

  RETURN _new;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_credits(numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_credits(numeric, text) TO authenticated;

-- 4) Ações administrativas
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(_target_user_id text, _delta numeric, _reason text DEFAULT '')
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor text := (auth.uid())::text;
  _new numeric;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _delta IS NULL OR _delta = 0 OR abs(_delta) > 1000000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.profiles
     SET credits = GREATEST(0, credits + _delta)
   WHERE user_id = _target_user_id
  RETURNING credits INTO _new;

  IF _new IS NULL THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
  VALUES (_target_user_id, _actor,
          CASE WHEN _delta > 0 THEN 'admin_credit' ELSE 'admin_debit' END,
          abs(_delta), _new, COALESCE(_reason, ''));

  RETURN _new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_credits(text, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_adjust_credits(text, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_plan(_target_user_id text, _plan text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _plan NOT IN ('free','dealer','master','diamond') THEN
    RAISE EXCEPTION 'invalid_plan';
  END IF;

  UPDATE public.profiles SET plano = _plan WHERE user_id = _target_user_id;

  INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason)
  SELECT _target_user_id, (auth.uid())::text, 'plan', 0, credits, 'plano: ' || _plan
    FROM public.profiles WHERE user_id = _target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_plan(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_plan(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_role(_target_user_id text, _cargo app_cargo)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _target_user_id;
  INSERT INTO public.user_roles(user_id, cargo, assigned_by)
  VALUES (_target_user_id, _cargo, (auth.uid())::text);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_role(text, app_cargo) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_role(text, app_cargo) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_ban_user(_target_user_id text, _reason text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _p record;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _target_user_id = (auth.uid())::text THEN
    RAISE EXCEPTION 'cannot_ban_self';
  END IF;

  SELECT name, email INTO _p FROM public.profiles WHERE user_id = _target_user_id;

  INSERT INTO public.blocked_users(user_id, user_name, user_email, reason, status)
  VALUES (_target_user_id, COALESCE(_p.name,''), COALESCE(_p.email,''), COALESCE(_reason,''), 'bloqueado');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ban_user(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_unban_user(_target_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  DELETE FROM public.blocked_users WHERE user_id = _target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_unban_user(text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_unban_user(text) TO authenticated;
