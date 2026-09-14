
CREATE TYPE public.app_role AS ENUM ('requester','area_owner','safety_officer','admin');

CREATE TYPE public.permit_status AS ENUM (
  'DRAFT','PENDING_APPROVAL','APPROVED','ACTIVE','SUSPENDED','REJECTED',
  'EXPIRED','CLOSED','CLOSED_VERIFIED','CANCELLED'
);

CREATE TYPE public.approval_decision AS ENUM ('PENDING','APPROVED','REJECTED');

-- People
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  full_name text NOT NULL,
  email text,
  job_title text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles writable by authenticated" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Roles (separate table, never on profiles)
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (profile_id, role)
);
GRANT SELECT ON public.user_roles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles readable" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "roles writable by authenticated" ON public.user_roles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE p.user_id = _user_id AND ur.role = _role
  )
$$;

-- Plants / areas
CREATE TABLE public.plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plants TO authenticated;
GRANT ALL ON public.plants TO service_role;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plants readable" ON public.plants FOR SELECT USING (true);
CREATE POLICY "plants writable by authenticated" ON public.plants FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  area_owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id, code)
);
GRANT SELECT ON public.areas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas readable" ON public.areas FOR SELECT USING (true);
CREATE POLICY "areas writable by authenticated" ON public.areas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Permit types are DATA, not code: a 5th type is just a new row
CREATE TABLE public.permit_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  accent text NOT NULL DEFAULT 'safety',
  field_schema jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permit_types TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permit_types TO authenticated;
GRANT ALL ON public.permit_types TO service_role;
ALTER TABLE public.permit_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permit types readable" ON public.permit_types FOR SELECT USING (true);
CREATE POLICY "permit types writable by authenticated" ON public.permit_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ONE shared permit entity
CREATE TABLE public.permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_number text NOT NULL UNIQUE,
  permit_type_id uuid NOT NULL REFERENCES public.permit_types(id) ON DELETE RESTRICT,
  status public.permit_status NOT NULL DEFAULT 'DRAFT',
  requester_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contractor_company text,
  work_team text,
  work_description text NOT NULL,
  plant_id uuid REFERENCES public.plants(id) ON DELETE SET NULL,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  equipment text,
  planned_start timestamptz NOT NULL,
  planned_end timestamptz NOT NULL,
  hazards text[] NOT NULL DEFAULT '{}',
  ppe text[] NOT NULL DEFAULT '{}',
  precautions text[] NOT NULL DEFAULT '{}',
  type_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX permits_status_idx ON public.permits (status);
CREATE INDEX permits_type_idx ON public.permits (permit_type_id);
CREATE INDEX permits_window_idx ON public.permits (planned_start);
GRANT SELECT ON public.permits TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permits TO authenticated;
GRANT ALL ON public.permits TO service_role;
ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "permits readable" ON public.permits FOR SELECT USING (true);
CREATE POLICY "permits writable by authenticated" ON public.permits FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER permits_set_updated_at BEFORE UPDATE ON public.permits
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.permit_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid NOT NULL REFERENCES public.permits(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  required_role public.app_role NOT NULL,
  approver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision public.approval_decision NOT NULL DEFAULT 'PENDING',
  comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (permit_id, step_order)
);
GRANT SELECT ON public.permit_approvals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permit_approvals TO authenticated;
GRANT ALL ON public.permit_approvals TO service_role;
ALTER TABLE public.permit_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals readable" ON public.permit_approvals FOR SELECT USING (true);
CREATE POLICY "approvals writable by authenticated" ON public.permit_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.permit_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid NOT NULL REFERENCES public.permits(id) ON DELETE CASCADE,
  from_status public.permit_status,
  to_status public.permit_status NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX permit_status_history_permit_idx ON public.permit_status_history (permit_id, created_at DESC);
GRANT SELECT ON public.permit_status_history TO anon;
GRANT SELECT, INSERT ON public.permit_status_history TO authenticated;
GRANT ALL ON public.permit_status_history TO service_role;
ALTER TABLE public.permit_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history readable" ON public.permit_status_history FOR SELECT USING (true);
CREATE POLICY "history insert by authenticated" ON public.permit_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- ============ reference + demo data ============
INSERT INTO public.permit_types (code, name, description, accent, sort_order, field_schema) VALUES
('HOT_WORK','Hot Work','Welding, cutting, grinding or any spark-producing work','safety',1,
 '[{"key":"gas_reading","label":"Gas monitor reading","type":"text"},{"key":"fire_extinguishers","label":"Fire extinguishers on site","type":"text"},{"key":"fire_watch","label":"Fire watch assigned","type":"boolean"},{"key":"zone_demarcated","label":"Hot work zone demarcated","type":"boolean"},{"key":"post_work_watch_min","label":"Post-work fire watch (minutes)","type":"number"}]'::jsonb),
('CONFINED_SPACE','Confined Space Entry','Entry into tanks, vessels, silos or vaults','approved',2,
 '[{"key":"oxygen_pct","label":"Oxygen level (%)","type":"number"},{"key":"lel_pct","label":"LEL (%)","type":"number"},{"key":"h2s_ppm","label":"H2S (ppm)","type":"number"},{"key":"attendant","label":"Standby attendant","type":"text"},{"key":"rescue_plan","label":"Rescue plan in place","type":"boolean"},{"key":"ventilation","label":"Forced ventilation","type":"boolean"}]'::jsonb),
('WORKING_AT_HEIGHT','Working at Height','Work above 1.8 m or near unprotected edges','pending',3,
 '[{"key":"work_height_m","label":"Working height (m)","type":"number"},{"key":"access_method","label":"Access method","type":"text"},{"key":"anchor_points","label":"Anchor points inspected","type":"boolean"},{"key":"harness_inspection","label":"Harness inspection date","type":"text"},{"key":"drop_zone_barricaded","label":"Drop zone barricaded","type":"boolean"}]'::jsonb),
('ELECTRICAL_LOTO','Electrical / Isolation (LOTO)','Electrical work requiring lockout-tagout isolation','closed',4,
 '[{"key":"voltage","label":"System voltage","type":"text"},{"key":"isolation_points","label":"Isolation points","type":"number"},{"key":"lock_tag_ids","label":"Lock / tag IDs","type":"text"},{"key":"zero_energy_verified","label":"Zero energy verified","type":"boolean"},{"key":"earthing_applied","label":"Earthing applied","type":"boolean"}]'::jsonb);

INSERT INTO public.profiles (id, full_name, email, job_title) VALUES
('11111111-1111-1111-1111-111111111101','D. Reyes','d.reyes@riverbend.example','Maintenance Technician'),
('11111111-1111-1111-1111-111111111102','A. Ng','a.ng@riverbend.example','Process Technician'),
('11111111-1111-1111-1111-111111111103','S. Patel','s.patel@riverbend.example','Rigging Supervisor'),
('11111111-1111-1111-1111-111111111104','K. Osei','k.osei@riverbend.example','Electrical Technician'),
('11111111-1111-1111-1111-111111111105','R. Whitfield','r.whitfield@riverbend.example','Area Owner — Boiler House'),
('11111111-1111-1111-1111-111111111106','L. Okafor','l.okafor@riverbend.example','Area Owner — Tank Farm'),
('11111111-1111-1111-1111-111111111107','M. Sandoval','m.sandoval@riverbend.example','Safety Officer'),
('11111111-1111-1111-1111-111111111108','P. Adeyemi','p.adeyemi@riverbend.example','Plant Administrator');

INSERT INTO public.user_roles (profile_id, role) VALUES
('11111111-1111-1111-1111-111111111101','requester'),
('11111111-1111-1111-1111-111111111102','requester'),
('11111111-1111-1111-1111-111111111103','requester'),
('11111111-1111-1111-1111-111111111104','requester'),
('11111111-1111-1111-1111-111111111105','area_owner'),
('11111111-1111-1111-1111-111111111106','area_owner'),
('11111111-1111-1111-1111-111111111107','safety_officer'),
('11111111-1111-1111-1111-111111111108','admin');

INSERT INTO public.plants (id, code, name) VALUES
('22222222-2222-2222-2222-222222222201','RB04','Riverbend 04'),
('22222222-2222-2222-2222-222222222202','NH02','Northgate Heat 02');

INSERT INTO public.areas (id, plant_id, code, name, area_owner_id) VALUES
('33333333-3333-3333-3333-333333333301','22222222-2222-2222-2222-222222222201','BH','Boiler House','11111111-1111-1111-1111-111111111105'),
('33333333-3333-3333-3333-333333333302','22222222-2222-2222-2222-222222222201','TF','Tank Farm T-102','11111111-1111-1111-1111-111111111106'),
('33333333-3333-3333-3333-333333333303','22222222-2222-2222-2222-222222222201','CT','Cooling Tower 2','11111111-1111-1111-1111-111111111105'),
('33333333-3333-3333-3333-333333333304','22222222-2222-2222-2222-222222222201','SS','Substation A','11111111-1111-1111-1111-111111111106'),
('33333333-3333-3333-3333-333333333305','22222222-2222-2222-2222-222222222202','WB','Weld Bay 3','11111111-1111-1111-1111-111111111105');

INSERT INTO public.permits (id, permit_number, permit_type_id, status, requester_id, contractor_company, work_team, work_description, plant_id, area_id, equipment, planned_start, planned_end, hazards, ppe, precautions, type_data) VALUES
('44444444-4444-4444-4444-444444444401','PTW-2405-0193',(SELECT id FROM public.permit_types WHERE code='HOT_WORK'),'ACTIVE','11111111-1111-1111-1111-111111111101','Kestrel Mechanical','Weld crew A','Oxy-fuel cutting and tack welding on the R-201 reheater inlet header flange. Fire watch stationed at all egress points for the full duration plus 30 minutes.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333301','Reheater R-201 header', now() - interval '3 hours', now() + interval '5 hours', ARRAY['Ignition source','Sparks / slag','Overhead pipework'], ARRAY['Welding shield','FR coveralls','Gloves','Boots'], ARRAY['Combustibles removed 11 m','Fire blanket rigged','Zone taped'], '{"gas_reading":"LEL 0%","fire_extinguishers":"2 x 9kg","fire_watch":true,"zone_demarcated":true,"post_work_watch_min":30}'::jsonb),
('44444444-4444-4444-4444-444444444402','PTW-2405-0192',(SELECT id FROM public.permit_types WHERE code='CONFINED_SPACE'),'ACTIVE','11111111-1111-1111-1111-111111111102','In-house','Vessel crew 2','Internal cleaning and sludge removal from tank T-102 prior to inspection.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333302','Storage tank T-102', now() - interval '1 hour', now() + interval '7 hours', ARRAY['Oxygen deficiency','Residual hydrocarbons','Restricted egress'], ARRAY['SCBA','Harness','Gas monitor'], ARRAY['Continuous ventilation','Attendant at manway','Comms check every 15 min'], '{"oxygen_pct":20.9,"lel_pct":0,"h2s_ppm":0,"attendant":"J. Mirren","rescue_plan":true,"ventilation":true}'::jsonb),
('44444444-4444-4444-4444-444444444403','PTW-2405-0195',(SELECT id FROM public.permit_types WHERE code='WORKING_AT_HEIGHT'),'PENDING_APPROVAL','11111111-1111-1111-1111-111111111103','Apex Access','Rope team','Replacement of drift eliminator panels on cooling tower cell 2 upper deck.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333303','Cooling tower cell 2', now() + interval '20 hours', now() + interval '28 hours', ARRAY['Fall from height','Dropped objects','Wet surfaces'], ARRAY['Full body harness','Helmet with chinstrap','Non-slip boots'], ARRAY['Exclusion zone below','Twin lanyard 100% tie-off','Wind limit 30 km/h'], '{"work_height_m":18,"access_method":"Rope access","anchor_points":true,"harness_inspection":"2026-08-02","drop_zone_barricaded":true}'::jsonb),
('44444444-4444-4444-4444-444444444404','PTW-2405-0196',(SELECT id FROM public.permit_types WHERE code='ELECTRICAL_LOTO'),'APPROVED','11111111-1111-1111-1111-111111111104','Voltflow Ltd','Electrical crew','Breaker replacement on feeder panel 12, substation A. Full isolation and earthing required.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333304','Feeder panel 12', now() + interval '26 hours', now() + interval '32 hours', ARRAY['Arc flash','Stored energy','Unexpected re-energisation'], ARRAY['Arc flash suit','Insulated gloves','Face shield'], ARRAY['Lockout applied','Test-before-touch','Earths applied'], '{"voltage":"11 kV","isolation_points":3,"lock_tag_ids":"LK-3391, LK-3392, LK-3393","zero_energy_verified":true,"earthing_applied":true}'::jsonb),
('44444444-4444-4444-4444-444444444405','PTW-2405-0190',(SELECT id FROM public.permit_types WHERE code='HOT_WORK'),'SUSPENDED','11111111-1111-1111-1111-111111111101','Kestrel Mechanical','Weld crew B','Structural bracket welding in weld bay 3. Suspended pending re-test of the local extraction system.','22222222-2222-2222-2222-222222222202','33333333-3333-3333-3333-333333333305','Bay 3 fabrication jig', now() - interval '1 day', now() + interval '2 hours', ARRAY['Welding fume','Sparks / slag'], ARRAY['Welding shield','FR coveralls'], ARRAY['Local exhaust ventilation','Screens erected'], '{"gas_reading":"n/a","fire_extinguishers":"1 x 9kg","fire_watch":true,"zone_demarcated":true,"post_work_watch_min":30}'::jsonb),
('44444444-4444-4444-4444-444444444406','PTW-2405-0187',(SELECT id FROM public.permit_types WHERE code='CONFINED_SPACE'),'CLOSED_VERIFIED','11111111-1111-1111-1111-111111111102','In-house','Vessel crew 1','Reactor vessel internal inspection following shutdown. Work completed and area handed back.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333302','Reactor vessel R-11', now() - interval '3 days', now() - interval '3 days' + interval '6 hours', ARRAY['Oxygen deficiency','Restricted egress'], ARRAY['SCBA','Harness'], ARRAY['Continuous gas monitoring','Attendant at manway'], '{"oxygen_pct":20.8,"lel_pct":0,"h2s_ppm":0,"attendant":"L. Okafor","rescue_plan":true,"ventilation":true}'::jsonb),
('44444444-4444-4444-4444-444444444407','PTW-2405-0179',(SELECT id FROM public.permit_types WHERE code='HOT_WORK'),'REJECTED','11111111-1111-1111-1111-111111111101','Kestrel Mechanical','Weld crew A','Pipe spool cutting adjacent to tank T-102 bund. Rejected: gas test evidence incomplete.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333302','Pipe spool 12-A', now() - interval '4 days', now() - interval '4 days' + interval '4 hours', ARRAY['Ignition source','Flammable atmosphere'], ARRAY['FR coveralls','Welding shield'], ARRAY['Gas test required before start'], '{"gas_reading":"not recorded","fire_extinguishers":"1 x 9kg","fire_watch":false,"zone_demarcated":false,"post_work_watch_min":30}'::jsonb),
('44444444-4444-4444-4444-444444444408','PTW-2405-0198',(SELECT id FROM public.permit_types WHERE code='WORKING_AT_HEIGHT'),'DRAFT','11111111-1111-1111-1111-111111111103','Apex Access','Rope team','Gutter and downpipe survey on boiler house roof. Draft pending scope confirmation.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333301','Boiler house roof', now() + interval '3 days', now() + interval '3 days' + interval '5 hours', ARRAY['Fall from height','Fragile roof'], ARRAY['Full body harness','Helmet'], ARRAY['Crawler boards','Edge protection'], '{"work_height_m":12,"access_method":"Roof anchor line","anchor_points":false,"harness_inspection":"2026-08-02","drop_zone_barricaded":false}'::jsonb),
('44444444-4444-4444-4444-444444444409','PTW-2405-0175',(SELECT id FROM public.permit_types WHERE code='ELECTRICAL_LOTO'),'EXPIRED','11111111-1111-1111-1111-111111111104','Voltflow Ltd','Electrical crew','Lighting circuit re-termination in substation A. Permit window elapsed before completion.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333304','Lighting DB-4', now() - interval '6 days', now() - interval '6 days' + interval '4 hours', ARRAY['Electric shock'], ARRAY['Insulated gloves','Safety glasses'], ARRAY['Circuit locked off'], '{"voltage":"400 V","isolation_points":1,"lock_tag_ids":"LK-3310","zero_energy_verified":true,"earthing_applied":false}'::jsonb),
('44444444-4444-4444-4444-444444444410','PTW-2405-0168',(SELECT id FROM public.permit_types WHERE code='HOT_WORK'),'CLOSED','11111111-1111-1111-1111-111111111101','In-house','Weld crew B','Handrail repair welding on the boiler house walkway. Work complete, closure verification outstanding.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333301','Walkway handrail W-3', now() - interval '8 days', now() - interval '8 days' + interval '3 hours', ARRAY['Sparks / slag'], ARRAY['Welding shield','Gloves'], ARRAY['Fire blanket below walkway'], '{"gas_reading":"LEL 0%","fire_extinguishers":"1 x 9kg","fire_watch":true,"zone_demarcated":true,"post_work_watch_min":30}'::jsonb),
('44444444-4444-4444-4444-444444444411','PTW-2405-0161',(SELECT id FROM public.permit_types WHERE code='CONFINED_SPACE'),'CANCELLED','11111111-1111-1111-1111-111111111102','In-house','Vessel crew 2','Silo 5 residue removal. Cancelled at requester''s request; work rescheduled to next shutdown.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333302','Silo 5', now() - interval '10 days', now() - interval '10 days' + interval '6 hours', ARRAY['Engulfment','Oxygen deficiency'], ARRAY['SCBA','Harness'], ARRAY['Silo isolated and locked'], '{"oxygen_pct":20.9,"lel_pct":0,"h2s_ppm":0,"attendant":"TBC","rescue_plan":false,"ventilation":true}'::jsonb),
('44444444-4444-4444-4444-444444444412','PTW-2405-0199',(SELECT id FROM public.permit_types WHERE code='ELECTRICAL_LOTO'),'PENDING_APPROVAL','11111111-1111-1111-1111-111111111104','Voltflow Ltd','Electrical crew','Motor starter isolation for cooling tower fan 2B bearing replacement.','22222222-2222-2222-2222-222222222201','33333333-3333-3333-3333-333333333303','Fan 2B starter', now() + interval '16 hours', now() + interval '22 hours', ARRAY['Stored energy','Rotating equipment'], ARRAY['Insulated gloves','Helmet'], ARRAY['Lockout applied','Fan blade secured'], '{"voltage":"400 V","isolation_points":2,"lock_tag_ids":"LK-3401, LK-3402","zero_energy_verified":false,"earthing_applied":false}'::jsonb);

INSERT INTO public.permit_approvals (permit_id, step_order, required_role, approver_id, decision, comment, decided_at) VALUES
('44444444-4444-4444-4444-444444444401',1,'area_owner','11111111-1111-1111-1111-111111111105','APPROVED','Area released for hot work.', now() - interval '4 hours'),
('44444444-4444-4444-4444-444444444401',2,'safety_officer','11111111-1111-1111-1111-111111111107','APPROVED','Gas test witnessed, fire watch briefed.', now() - interval '3 hours 40 minutes'),
('44444444-4444-4444-4444-444444444401',3,'admin','11111111-1111-1111-1111-111111111108','APPROVED','Activated.', now() - interval '3 hours'),
('44444444-4444-4444-4444-444444444402',1,'area_owner','11111111-1111-1111-1111-111111111106','APPROVED','Tank drained and isolated.', now() - interval '2 hours'),
('44444444-4444-4444-4444-444444444402',2,'safety_officer','11111111-1111-1111-1111-111111111107','APPROVED','Atmosphere clear, attendant posted.', now() - interval '90 minutes'),
('44444444-4444-4444-4444-444444444402',3,'admin','11111111-1111-1111-1111-111111111108','APPROVED','Activated.', now() - interval '1 hour'),
('44444444-4444-4444-4444-444444444403',1,'area_owner','11111111-1111-1111-1111-111111111105','APPROVED','No conflicting work on the deck.', now() - interval '2 hours'),
('44444444-4444-4444-4444-444444444403',2,'safety_officer','11111111-1111-1111-1111-111111111107','PENDING',NULL,NULL),
('44444444-4444-4444-4444-444444444403',3,'admin','11111111-1111-1111-1111-111111111108','PENDING',NULL,NULL),
('44444444-4444-4444-4444-444444444404',1,'area_owner','11111111-1111-1111-1111-111111111106','APPROVED','Feeder scheduled out of service.', now() - interval '5 hours'),
('44444444-4444-4444-4444-444444444404',2,'safety_officer','11111111-1111-1111-1111-111111111107','APPROVED','LOTO plan reviewed.', now() - interval '4 hours'),
('44444444-4444-4444-4444-444444444404',3,'admin','11111111-1111-1111-1111-111111111108','PENDING',NULL,NULL),
('44444444-4444-4444-4444-444444444405',1,'area_owner','11111111-1111-1111-1111-111111111105','APPROVED','Bay available.', now() - interval '1 day 2 hours'),
('44444444-4444-4444-4444-444444444405',2,'safety_officer','11111111-1111-1111-1111-111111111107','APPROVED','Suspended later — extraction fault.', now() - interval '1 day 1 hour'),
('44444444-4444-4444-4444-444444444407',1,'area_owner','11111111-1111-1111-1111-111111111106','APPROVED','Bund access agreed.', now() - interval '4 days 2 hours'),
('44444444-4444-4444-4444-444444444407',2,'safety_officer','11111111-1111-1111-1111-111111111107','REJECTED','No gas test record attached. Resubmit with readings.', now() - interval '4 days 1 hour'),
('44444444-4444-4444-4444-444444444412',1,'area_owner','11111111-1111-1111-1111-111111111105','PENDING',NULL,NULL),
('44444444-4444-4444-4444-444444444412',2,'safety_officer','11111111-1111-1111-1111-111111111107','PENDING',NULL,NULL),
('44444444-4444-4444-4444-444444444412',3,'admin','11111111-1111-1111-1111-111111111108','PENDING',NULL,NULL);

INSERT INTO public.permit_status_history (permit_id, from_status, to_status, changed_by, note, created_at) VALUES
('44444444-4444-4444-4444-444444444401','APPROVED','ACTIVE','11111111-1111-1111-1111-111111111108','Work started on site.', now() - interval '3 hours'),
('44444444-4444-4444-4444-444444444402','APPROVED','ACTIVE','11111111-1111-1111-1111-111111111108','Entry commenced.', now() - interval '1 hour'),
('44444444-4444-4444-4444-444444444405','ACTIVE','SUSPENDED','11111111-1111-1111-1111-111111111107','Local extraction fault, work stopped.', now() - interval '20 hours'),
('44444444-4444-4444-4444-444444444406','CLOSED','CLOSED_VERIFIED','11111111-1111-1111-1111-111111111107','Area inspected and handed back.', now() - interval '2 days'),
('44444444-4444-4444-4444-444444444407','PENDING_APPROVAL','REJECTED','11111111-1111-1111-1111-111111111107','Incomplete gas test evidence.', now() - interval '4 days 1 hour'),
('44444444-4444-4444-4444-444444444409','ACTIVE','EXPIRED',NULL,'Permit window elapsed.', now() - interval '5 days 20 hours'),
('44444444-4444-4444-4444-444444444411','PENDING_APPROVAL','CANCELLED','11111111-1111-1111-1111-111111111102','Rescheduled to next shutdown.', now() - interval '10 days');
