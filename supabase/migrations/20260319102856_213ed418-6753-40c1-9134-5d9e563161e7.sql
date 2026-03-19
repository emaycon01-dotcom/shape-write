
-- 1. Create has_role function for secure RLS checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _cargo public.app_cargo)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id::text
      AND cargo = _cargo
  )
$$;

-- 2. Drop all existing overly-permissive policies
DROP POLICY IF EXISTS "Allow all operations on documents" ON public.documents;
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public write profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public access user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Public access recharge_logs" ON public.recharge_logs;
DROP POLICY IF EXISTS "Public access generation_logs" ON public.generation_logs;
DROP POLICY IF EXISTS "Public access deposits" ON public.deposits;
DROP POLICY IF EXISTS "Public access blocked_users" ON public.blocked_users;

-- 3. documents: owner-scoped + admin read
CREATE POLICY "Owner can select documents" ON public.documents FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Owner can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Owner can update documents" ON public.documents FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Owner can delete documents" ON public.documents FOR DELETE TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Admin can select all documents" ON public.documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. profiles: owner-scoped + admin read
CREATE POLICY "Owner can select profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Owner can insert profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Owner can update profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Admin can select all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. user_roles: owner can read own, admin can manage all
CREATE POLICY "Owner can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Admin can manage all roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. generation_logs: owner-scoped + admin read
CREATE POLICY "Owner can select own logs" ON public.generation_logs FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Owner can insert own logs" ON public.generation_logs FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Admin can select all logs" ON public.generation_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. deposits: owner read + insert, admin full
CREATE POLICY "Owner can select own deposits" ON public.deposits FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Owner can insert own deposits" ON public.deposits FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Admin can manage all deposits" ON public.deposits FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. blocked_users: admin only
CREATE POLICY "Admin can manage blocked users" ON public.blocked_users FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 9. recharge_logs: owner-scoped
CREATE POLICY "Owner can select own recharge" ON public.recharge_logs FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Owner can insert own recharge" ON public.recharge_logs FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);

-- 10. Make storage bucket private
UPDATE storage.buckets SET public = false WHERE id = 'documents-pdf';

-- 11. Update storage policies
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Public upload access" ON storage.objects;
DROP POLICY IF EXISTS "Public update access" ON storage.objects;
DROP POLICY IF EXISTS "Public delete access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;

CREATE POLICY "Auth users can upload to documents-pdf" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents-pdf');
CREATE POLICY "Auth users can read from documents-pdf" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents-pdf');
CREATE POLICY "Auth users can update in documents-pdf" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents-pdf');
