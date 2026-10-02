-- ============================================================================
-- Phase 1: auth ↔ profile linkage + role-aware RLS
--
-- Context: every table currently has a blanket
--   `FOR ALL TO authenticated USING (true) WITH CHECK (true)`
-- write policy. That's fine while the app has zero write paths, but it means
-- the moment any mutation ships, any signed-up user could write any row in
-- any table -- including inserting themselves into user_roles as 'admin'.
-- This migration is purely additive: it does not touch any existing table,
-- column, or SELECT ("...readable") policy, so every current read-only
-- feature (dashboard, register, permit detail) keeps working unchanged.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Auto-create a profile (+ default 'requester' role) when someone signs up.
--    Without this, a new auth.users row had no corresponding profiles/
--    user_roles row at all, so a freshly registered user was authenticated
--    but invisible to the rest of the domain model.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_profile_id uuid;
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  RETURNING id INTO new_profile_id;

  INSERT INTO public.user_roles (profile_id, role)
  VALUES (new_profile_id, 'requester');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. Helper: the calling user's own profile id. Used throughout the RLS
--    policies below so "is this row mine?" checks read cleanly.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Auto-generate permit numbers (PTW-YYMM-####) on insert, matching the
--    format already used by the seed data, so a future "create permit"
--    mutation never has to invent one client-side.
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.permit_number_seq;

CREATE OR REPLACE FUNCTION public.assign_permit_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.permit_number IS NULL THEN
    NEW.permit_number := 'PTW-' || to_char(now(), 'YYMM') || '-' ||
      lpad(nextval('public.permit_number_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS permits_assign_number ON public.permits;
CREATE TRIGGER permits_assign_number
  BEFORE INSERT ON public.permits
  FOR EACH ROW EXECUTE FUNCTION public.assign_permit_number();

-- ----------------------------------------------------------------------------
-- 4. Replace the blanket "authenticated can write anything" policies with
--    role/ownership-aware ones. SELECT policies are untouched.
-- ----------------------------------------------------------------------------

-- profiles: users manage their own row; admins manage any
DROP POLICY IF EXISTS "profiles writable by authenticated" ON public.profiles;

CREATE POLICY "profiles insert self or admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles update self or admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "profiles delete admin only" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- user_roles: admin-only writes -- this is the policy that previously let
-- any authenticated user grant themselves 'admin'.
DROP POLICY IF EXISTS "roles writable by authenticated" ON public.user_roles;

CREATE POLICY "roles writable by admin" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- plants / areas / permit_types: reference data, admin-only writes
DROP POLICY IF EXISTS "plants writable by authenticated" ON public.plants;
CREATE POLICY "plants writable by admin" ON public.plants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "areas writable by authenticated" ON public.areas;
CREATE POLICY "areas writable by admin" ON public.areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "permit types writable by authenticated" ON public.permit_types;
CREATE POLICY "permit types writable by admin" ON public.permit_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- permits: a requester can create/manage their own; area owners manage
-- permits in their area; safety officers manage any; admins manage any.
-- (RLS decides *which rows*; enforcing *which status transitions* is the
-- job of the server-function mutations added in Phase 2.)
DROP POLICY IF EXISTS "permits writable by authenticated" ON public.permits;

CREATE POLICY "permits insert own" ON public.permits
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "permits update by stakeholders" ON public.permits
  FOR UPDATE TO authenticated
  USING (
    requester_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'safety_officer')
    OR EXISTS (
      SELECT 1 FROM public.areas a
      WHERE a.id = permits.area_id AND a.area_owner_id = public.current_profile_id()
    )
  )
  WITH CHECK (
    requester_id = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'safety_officer')
    OR EXISTS (
      SELECT 1 FROM public.areas a
      WHERE a.id = permits.area_id AND a.area_owner_id = public.current_profile_id()
    )
  );

CREATE POLICY "permits delete admin only" ON public.permits
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- permit_approvals: only the profile that raised the permit may create its
-- approval steps; only someone holding the step's required_role (or admin)
-- may decide it.
DROP POLICY IF EXISTS "approvals writable by authenticated" ON public.permit_approvals;

CREATE POLICY "approvals insert by permit owner or admin" ON public.permit_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.permits p
      WHERE p.id = permit_approvals.permit_id
        AND p.requester_id = public.current_profile_id()
    )
  );

CREATE POLICY "approvals decide by required role" ON public.permit_approvals
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), required_role) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), required_role) OR public.has_role(auth.uid(), 'admin'));

-- permit_status_history: append-only; callers may only attribute an entry
-- to themselves (or leave it system-attributed with NULL), not to someone else.
DROP POLICY IF EXISTS "history insert by authenticated" ON public.permit_status_history;

CREATE POLICY "history insert as self" ON public.permit_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    changed_by IS NULL
    OR changed_by = public.current_profile_id()
    OR public.has_role(auth.uid(), 'admin')
  );
