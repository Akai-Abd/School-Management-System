-- Phase 7 Admission Applications RLS Policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'school_erp_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE admission_applications TO school_erp_app;
  END IF;
END $$;

ALTER TABLE admission_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_applications FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON admission_applications;
CREATE POLICY tenant_isolation_policy ON admission_applications USING (
  COALESCE(current_setting('app.current_school_id', true), '') = ''
  OR school_id::text = current_setting('app.current_school_id', true)
) WITH CHECK (
  COALESCE(current_setting('app.current_school_id', true), '') = ''
  OR school_id::text = current_setting('app.current_school_id', true)
);
