-- Phase 4 Partial Unique Indexes (M12-AC1, M14-AC1, M14-AC4)

CREATE UNIQUE INDEX IF NOT EXISTS uq_book_issues_active_copy
  ON book_issues (school_id, copy_id)
  WHERE returned_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_allocations_active_bed
  ON hostel_allocations (school_id, bed_id)
  WHERE vacated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hostel_allocations_active_student
  ON hostel_allocations (school_id, student_id)
  WHERE vacated_at IS NULL;
