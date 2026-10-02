DROP TRIGGER IF EXISTS permits_enforce_workflow ON public.permits;
DROP FUNCTION IF EXISTS public.enforce_permit_workflow();

CREATE OR REPLACE FUNCTION public.enforce_permit_identity_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin') OR current_user = 'service_role';
BEGIN
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.requester_id IS DISTINCT FROM OLD.requester_id
     OR NEW.plant_id IS DISTINCT FROM OLD.plant_id
     OR NEW.area_id IS DISTINCT FROM OLD.area_id
     OR NEW.permit_type_id IS DISTINCT FROM OLD.permit_type_id
  THEN
    RAISE EXCEPTION
      'requester_id, plant_id, area_id and permit_type_id cannot be changed after a permit is created.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS permits_enforce_identity_columns ON public.permits;

CREATE TRIGGER permits_enforce_identity_columns
  BEFORE UPDATE OF requester_id, plant_id, area_id, permit_type_id
  ON public.permits
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_permit_identity_columns();
