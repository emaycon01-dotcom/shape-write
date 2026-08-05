CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND cargo = 'admin'::app_cargo
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin_user(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Staff can select all profiles" ON public.profiles;
CREATE POLICY "Staff can select non-admin profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  is_staff(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_cargo)
    OR user_id = (auth.uid())::text
    OR NOT public.is_admin_user(user_id)
  )
);

DROP POLICY IF EXISTS "Staff can manage all tickets" ON public.support_tickets;
CREATE POLICY "Staff can manage non-admin tickets"
ON public.support_tickets FOR ALL TO authenticated
USING (
  is_staff(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_cargo)
    OR user_id = (auth.uid())::text
    OR NOT public.is_admin_user(user_id)
  )
)
WITH CHECK (
  is_staff(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_cargo)
    OR user_id = (auth.uid())::text
    OR NOT public.is_admin_user(user_id)
  )
);

DROP POLICY IF EXISTS "Participants can select messages" ON public.support_messages;
CREATE POLICY "Participants can select messages"
ON public.support_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id
      AND (
        t.user_id = (auth.uid())::text
        OR (
          is_staff(auth.uid())
          AND (
            has_role(auth.uid(), 'admin'::app_cargo)
            OR NOT public.is_admin_user(t.user_id)
          )
        )
      )
  )
);