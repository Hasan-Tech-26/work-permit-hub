-- ============================================================================
-- Fix (Problem A): "approvals decide by required role" was role-only, with no
-- area scoping for area_owner-required steps. Any user holding the
-- area_owner role anywhere could decide the area_owner step on ANY permit,
-- in ANY area -- inconsistent with how `permits update by stakeholders`
-- correctly scopes area ownership. This migration replaces ONLY that one
-- policy. Nothing else changes: admin and safety_officer behavior, and
-- behavior for any required_role other than 'area_owner', are unchanged.
-- ============================================================================

DROP POLICY IF EXISTS "approvals decide by required role" ON public.permit_approvals;

CREATE POLICY "approvals decide by required role" ON public.permit_approvals
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      required_role <> 'area_owner'
      AND public.has_role(auth.uid(), required_role)
    )
    OR (
      required_role = 'area_owner'
      AND public.has_role(auth.uid(), 'area_owner')
      AND EXISTS (
        SELECT 1 FROM public.permits p
        JOIN public.areas a ON a.id = p.area_id
        WHERE p.id = permit_approvals.permit_id
          AND a.area_owner_id = public.current_profile_id()
      )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      required_role <> 'area_owner'
      AND public.has_role(auth.uid(), required_role)
    )
    OR (
      required_role = 'area_owner'
      AND public.has_role(auth.uid(), 'area_owner')
      AND EXISTS (
        SELECT 1 FROM public.permits p
        JOIN public.areas a ON a.id = p.area_id
        WHERE p.id = permit_approvals.permit_id
          AND a.area_owner_id = public.current_profile_id()
      )
    )
  );
