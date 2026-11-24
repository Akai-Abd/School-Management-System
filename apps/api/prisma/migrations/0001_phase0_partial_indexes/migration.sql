-- Phase 0 Foundation Migration + PostgreSQL Partial Unique Indexes
-- Note: Prisma handles table/FK creation in standard migrations; this SQL captures
-- soft-delete partial unique constraints that Prisma schema syntax cannot express natively.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Partial unique indexes for soft-deleted entities (active records remain unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_active
  ON users (LOWER(email))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_schools_slug_active
  ON schools (LOWER(slug))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_roles_school_key_active
  ON roles (school_id, LOWER(key))
  WHERE deleted_at IS NULL;
