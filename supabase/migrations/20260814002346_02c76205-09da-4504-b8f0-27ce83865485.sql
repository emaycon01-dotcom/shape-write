-- 1) Explicit owner/admin-scoped policies for the private 'documentos' bucket
DROP POLICY IF EXISTS "Admins can read documentos" ON storage.objects;
CREATE POLICY "Admins can read documentos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documentos' AND public.has_role(auth.uid(), 'admin'::app_cargo));

DROP POLICY IF EXISTS "Admins can delete documentos" ON storage.objects;
CREATE POLICY "Admins can delete documentos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documentos' AND public.has_role(auth.uid(), 'admin'::app_cargo));

-- No INSERT/UPDATE policies for 'documentos': writes are service-role only (edge functions).

-- 2) Tighten 'gerente' provisioning: only admins may grant/revoke roles,
--    and non-admins can never create admin/gerente roles.
CREATE OR REPLACE FUNCTION public.guard_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
  _role app_cargo := COALESCE(NEW.role, OLD.role);
BEGIN
  -- service_role / internal jobs (no JWT) are allowed
  IF _actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT public.has_role(_actor, 'admin'::app_cargo) THEN
    RAISE EXCEPTION 'forbidden: only admins can manage roles';
  END IF;

  INSERT INTO public.staff_action_logs (actor_id, action, details)
  VALUES (
    _actor::text,
    TG_OP || '_role',
    jsonb_build_object('target_user_id', COALESCE(NEW.user_id, OLD.user_id), 'role', _role)::text
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN undefined_column OR undefined_table THEN
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS guard_role_assignment_trg ON public.user_roles;
CREATE TRIGGER guard_role_assignment_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_role_assignment();