-- Phase 1 Partial Unique Indexes for soft-deleted entities & single active academic year

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_years_current_active
  ON academic_years (school_id)
  WHERE is_current = true AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_years_name_active
  ON academic_years (school_id, LOWER(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_school_name_active
  ON classes (school_id, LOWER(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sections_class_name_active
  ON sections (school_id, class_id, LOWER(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_school_code_active
  ON subjects (school_id, LOWER(code))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_employee_code_active
  ON staff (school_id, LOWER(employee_code))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_admission_number_active
  ON students (school_id, LOWER(admission_number))
  WHERE deleted_at IS NULL;
