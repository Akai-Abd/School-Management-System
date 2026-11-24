-- Phase 7 Contact Inquiries RLS Policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'school_erp_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE contact_inquiries TO school_erp_app;
  END IF;
END $$;

ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON contact_inquiries;
CREATE POLICY tenant_isolation_policy ON contact_inquiries USING (
  COALESCE(current_setting('app.current_school_id', true), '') = ''
  OR school_id::text = current_setting('app.current_school_id', true)
) WITH CHECK (
  COALESCE(current_setting('app.current_school_id', true), '') = ''
  OR school_id::text = current_setting('app.current_school_id', true)
);
