ALTER TABLE public.credit_transactions ADD COLUMN IF NOT EXISTS ref text;

CREATE UNIQUE INDEX IF NOT EXISTS credit_transactions_user_ref_uidx
  ON public.credit_transactions(user_id, ref)
  WHERE ref IS NOT NULL;

CREATE OR REPLACE FUNCTION public.consume_credits(_amount numeric, _reason text DEFAULT 'geracao', _ref text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid text := (auth.uid())::text;
  _new numeric;
  _existing numeric;
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

  -- Idempotência: o mesmo documento gerado de novo (retry, recarregar a tela,
  -- clique duplo) não cobra outra vez dentro de 12 horas.
  IF _ref IS NOT NULL THEN
    SELECT credits INTO _existing FROM public.profiles WHERE user_id = _uid;
    IF EXISTS (
      SELECT 1 FROM public.credit_transactions
       WHERE user_id = _uid AND ref = _ref AND created_at > now() - interval '12 hours'
    ) THEN
      RETURN COALESCE(_existing, 0);
    END IF;
  END IF;

  UPDATE public.profiles
     SET credits = credits - _amount
   WHERE user_id = _uid
     AND credits >= _amount
  RETURNING credits INTO _new;

  IF _new IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  BEGIN
    INSERT INTO public.credit_transactions(user_id, actor_id, kind, amount, balance_after, reason, ref)
    VALUES (_uid, _uid, 'debit', _amount, _new, COALESCE(_reason, 'geracao'), _ref);
  EXCEPTION WHEN unique_violation THEN
    -- Corrida entre dois cliques: devolve o crédito e mantém apenas uma cobrança.
    UPDATE public.profiles SET credits = credits + _amount WHERE user_id = _uid
      RETURNING credits INTO _new;
  END;

  RETURN _new;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_credits(numeric, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_credits(numeric, text, text) TO authenticated;