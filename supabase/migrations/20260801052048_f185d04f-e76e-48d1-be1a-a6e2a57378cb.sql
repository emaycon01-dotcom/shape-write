CREATE OR REPLACE FUNCTION public.trim_credit_transactions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.credit_transactions ct
  USING (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
    FROM public.credit_transactions
    WHERE user_id IN (SELECT DISTINCT user_id FROM new_rows)
  ) ranked
  WHERE ct.id = ranked.id AND ranked.rn > 50;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trim_credit_transactions_trg ON public.credit_transactions;
CREATE TRIGGER trim_credit_transactions_trg
AFTER INSERT ON public.credit_transactions
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trim_credit_transactions();

CREATE OR REPLACE FUNCTION public.trim_generation_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.generation_logs gl
  USING (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rn
    FROM public.generation_logs
    WHERE user_id IN (SELECT DISTINCT user_id FROM new_rows)
  ) ranked
  WHERE gl.id = ranked.id AND ranked.rn > 50;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trim_generation_logs_trg ON public.generation_logs;
CREATE TRIGGER trim_generation_logs_trg
AFTER INSERT ON public.generation_logs
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.trim_generation_logs();