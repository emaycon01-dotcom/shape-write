
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id::text
      AND cargo IN ('admin'::app_cargo, 'gerente'::app_cargo)
  )
$$;

-- Chamados
DROP POLICY IF EXISTS "Admin can manage all tickets" ON public.support_tickets;
CREATE POLICY "Staff can manage all tickets" ON public.support_tickets
FOR ALL TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Participants can select messages" ON public.support_messages;
CREATE POLICY "Participants can select messages" ON public.support_messages
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.support_tickets t
          WHERE t.id = support_messages.ticket_id AND t.user_id = (auth.uid())::text)
  OR public.is_staff(auth.uid())
);

DROP POLICY IF EXISTS "Participants can insert messages" ON public.support_messages;
CREATE POLICY "Participants can insert messages" ON public.support_messages
FOR INSERT TO authenticated
WITH CHECK (
  author_id = (auth.uid())::text
  AND (
    EXISTS (SELECT 1 FROM public.support_tickets t
            WHERE t.id = support_messages.ticket_id
              AND t.user_id = (auth.uid())::text
              AND t.status = 'aberto')
    OR public.is_staff(auth.uid())
  )
);

-- Perfis: equipe pode visualizar (necessário para a fila de aprovações)
DROP POLICY IF EXISTS "Admin can select all profiles" ON public.profiles;
CREATE POLICY "Staff can select all profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

-- Aprovação de contas liberada para equipe
CREATE OR REPLACE FUNCTION public.admin_set_account_status(_target_user_id text, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
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
