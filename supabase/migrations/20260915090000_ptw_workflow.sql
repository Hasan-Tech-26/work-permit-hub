-- PTW workflow storage and database-level lifecycle guardrails.
CREATE TABLE public.permit_work_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid NOT NULL REFERENCES public.permits(id) ON DELETE CASCADE,
  logged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text NOT NULL,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX permit_work_logs_permit_idx ON public.permit_work_logs (permit_id, logged_at DESC);
GRANT SELECT, INSERT ON public.permit_work_logs TO authenticated;
GRANT SELECT ON public.permit_work_logs TO anon;
GRANT ALL ON public.permit_work_logs TO service_role;
ALTER TABLE public.permit_work_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "work logs readable" ON public.permit_work_logs FOR SELECT USING (true);
CREATE POLICY "work logs inserted by authenticated" ON public.permit_work_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.permit_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid NOT NULL REFERENCES public.permits(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_status public.permit_status,
  to_status public.permit_status,
  comment text,
  field_changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX permit_audit_log_permit_idx ON public.permit_audit_log (permit_id, created_at DESC);
GRANT SELECT, INSERT ON public.permit_audit_log TO authenticated;
GRANT SELECT ON public.permit_audit_log TO anon;
GRANT ALL ON public.permit_audit_log TO service_role;
ALTER TABLE public.permit_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit readable" ON public.permit_audit_log FOR SELECT USING (true);
CREATE POLICY "audit inserted by authenticated" ON public.permit_audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.user_roles_for_user(_user_id uuid)
RETURNS TABLE(role public.app_role) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ur.role FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.profile_id WHERE p.user_id = _user_id OR p.id = _user_id
$$;
GRANT EXECUTE ON FUNCTION public.user_roles_for_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expire_permit_if_needed(_permit_id uuid)
RETURNS public.permit_status LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE current_status public.permit_status;
BEGIN
  SELECT status INTO current_status FROM public.permits WHERE id = _permit_id FOR UPDATE;
  IF current_status IN ('APPROVED', 'ACTIVE', 'SUSPENDED') AND EXISTS (SELECT 1 FROM public.permits WHERE id = _permit_id AND planned_end <= now()) THEN
    UPDATE public.permits SET status = 'EXPIRED' WHERE id = _permit_id;
    INSERT INTO public.permit_status_history (permit_id, from_status, to_status, note) VALUES (_permit_id, current_status, 'EXPIRED', 'Permit validity window elapsed.');
    RETURN 'EXPIRED';
  END IF;
  RETURN current_status;
END;
$$;
GRANT EXECUTE ON FUNCTION public.expire_permit_if_needed(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reject_illegal_permit_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'DRAFT' AND NEW.status = 'PENDING_APPROVAL') OR
    (OLD.status = 'PENDING_APPROVAL' AND NEW.status IN ('APPROVED', 'REJECTED')) OR
    (OLD.status = 'APPROVED' AND NEW.status IN ('ACTIVE', 'CANCELLED', 'EXPIRED')) OR
    (OLD.status = 'ACTIVE' AND NEW.status IN ('SUSPENDED', 'CLOSED', 'CANCELLED', 'EXPIRED')) OR
    (OLD.status = 'SUSPENDED' AND NEW.status IN ('ACTIVE', 'CANCELLED', 'EXPIRED')) OR
    (OLD.status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'SUSPENDED') AND NEW.status = 'CANCELLED') OR
    (OLD.status = 'CLOSED' AND NEW.status = 'CLOSED_VERIFIED')
  ) THEN
    RAISE EXCEPTION 'Illegal permit transition: % -> %', OLD.status, NEW.status USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS permits_validate_transition ON public.permits;
CREATE TRIGGER permits_validate_transition BEFORE UPDATE OF status ON public.permits FOR EACH ROW EXECUTE FUNCTION public.reject_illegal_permit_transition();

CREATE OR REPLACE FUNCTION public.prevent_ptw_history_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Permit audit history is immutable'; END;
$$;
CREATE TRIGGER permit_status_history_immutable BEFORE UPDATE OR DELETE ON public.permit_status_history FOR EACH ROW EXECUTE FUNCTION public.prevent_ptw_history_mutation();
CREATE TRIGGER permit_audit_log_immutable BEFORE UPDATE OR DELETE ON public.permit_audit_log FOR EACH ROW EXECUTE FUNCTION public.prevent_ptw_history_mutation();

UPDATE public.permit_approvals
SET decision = 'APPROVED', decided_at = now(), comment = 'Approval chain complete.'
WHERE permit_id = '44444444-4444-4444-4444-444444444404' AND required_role = 'admin';