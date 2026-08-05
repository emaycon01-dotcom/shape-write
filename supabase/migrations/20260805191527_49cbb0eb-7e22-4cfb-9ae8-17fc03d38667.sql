CREATE TABLE public.staff_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id text NOT NULL,
  actor_name text NOT NULL DEFAULT '',
  actor_email text NOT NULL DEFAULT '',
  actor_cargo text NOT NULL DEFAULT '',
  target_user_id text NOT NULL,
  target_name text NOT NULL DEFAULT '',
  target_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  details text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.staff_action_logs TO authenticated;
GRANT ALL ON public.staff_action_logs TO service_role;

ALTER TABLE public.staff_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view staff action logs"
ON public.staff_action_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_cargo));

CREATE INDEX staff_action_logs_created_at_idx ON public.staff_action_logs (created_at DESC);