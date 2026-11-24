-- Phase 6 PostgreSQL Row-Level Security (FORCE ROW LEVEL SECURITY + SET LOCAL app.current_school_id)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'school_erp_app') THEN
    CREATE ROLE school_erp_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO school_erp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO school_erp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO school_erp_app;

DO $$
DECLARE
  tbl text;
  tenant_tables text[] := ARRAY[
    'school_settings', 'school_modules', 'school_memberships', 'roles', 'role_permissions',
    'user_roles', 'user_invitations', 'document_sequences', 'idempotency_keys', 'attachments',
    'academic_years', 'academic_terms', 'calendar_events', 'classes', 'sections', 'subjects',
    'subject_groups', 'class_subjects', 'departments', 'designations', 'staff',
    'staff_employment_history', 'teacher_profiles', 'class_teachers', 'teacher_assignments',
    'students', 'guardians', 'student_guardians', 'student_enrollments', 'student_subjects',
    'student_medical_records', 'student_emergency_contacts', 'import_batches',
    'attendance_sessions', 'student_attendance', 'staff_attendance', 'leave_requests',
    'timetable_periods', 'classrooms', 'timetable_entries', 'exams', 'exam_subjects',
    'marks', 'mark_revisions', 'homework', 'homework_submissions', 'student_promotions',
    'notifications', 'fee_types', 'fee_structures', 'fee_structure_items', 'invoices',
    'invoice_items', 'payments', 'payment_allocations', 'student_credits', 'payment_refunds',
    'financial_events', 'accounts', 'fiscal_years', 'accounting_periods', 'posting_rules',
    'journal_entries', 'journal_entry_lines', 'book_categories', 'books', 'book_copies',
    'book_issues', 'vehicles', 'transport_routes', 'route_stops', 'transport_assignments',
    'transport_attendance', 'hostels', 'hostel_rooms', 'hostel_beds', 'hostel_allocations',
    'notification_deliveries', 'messages', 'question_banks', 'questions', 'question_options',
    'online_exams', 'online_exam_questions', 'exam_attempts', 'exam_answers',
    'website_settings', 'website_pages', 'website_announcements', 'website_events'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation_policy ON %I USING (
        COALESCE(current_setting(''app.current_school_id'', true), '''') = ''''
        OR school_id::text = current_setting(''app.current_school_id'', true)
      ) WITH CHECK (
        COALESCE(current_setting(''app.current_school_id'', true), '''') = ''''
        OR school_id::text = current_setting(''app.current_school_id'', true)
      )',
      tbl
    );
  END LOOP;
END $$;
