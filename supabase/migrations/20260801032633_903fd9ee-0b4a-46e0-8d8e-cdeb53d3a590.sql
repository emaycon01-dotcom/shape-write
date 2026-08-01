CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  user_name text NOT NULL DEFAULT '',
  user_email text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'geral',
  status text NOT NULL DEFAULT 'aberto',
  closed_by text,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING ((auth.uid())::text = user_id);
CREATE POLICY "Owner can insert own tickets" ON public.support_tickets
  FOR INSERT TO authenticated WITH CHECK ((auth.uid())::text = user_id);
CREATE POLICY "Owner can update own tickets" ON public.support_tickets
  FOR UPDATE TO authenticated USING ((auth.uid())::text = user_id) WITH CHECK ((auth.uid())::text = user_id);
CREATE POLICY "Admin can manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_cargo)) WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id text NOT NULL,
  author_name text NOT NULL DEFAULT '',
  is_admin boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can select messages" ON public.support_messages
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = (auth.uid())::text)
    OR has_role(auth.uid(), 'admin'::app_cargo)
  );
CREATE POLICY "Participants can insert messages" ON public.support_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = (auth.uid())::text
    AND (
      EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = (auth.uid())::text AND t.status = 'aberto')
      OR has_role(auth.uid(), 'admin'::app_cargo)
    )
  );

CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id, status);
CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id, created_at);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();