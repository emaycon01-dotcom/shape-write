
-- Drop the existing permissive owner update policy
DROP POLICY IF EXISTS "Owner can update profile" ON public.profiles;

-- Create a restricted update policy that only allows updating name and email
CREATE POLICY "Owner can update own name and email"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Add admin update policy for all fields
CREATE POLICY "Admin can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_cargo))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_cargo));
