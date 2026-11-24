# School Management System (School ERP)
## Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Finalized — Ready for technical implementation planning  
**Date:** 25 November 2026  
**Product Type:** Multi-Tenant School ERP + Standalone School Management Software

---

# 1. Product Overview

## 1.1 Product Vision

Build a comprehensive, scalable and secure School Management System that digitizes school administration, academic operations, financial management, communication and institutional reporting.

The system must support:

1. Multiple schools operating through a centralized cloud SaaS platform.
2. Independent standalone installations for individual schools.
3. Configurable modules and permissions.
4. Responsive interfaces for desktop, tablet and mobile.
5. Long-term academic and financial record management.

The application should provide a unified platform for administrators, teachers, parents, students, accountants, librarians and drivers.

## 1.2 Product Objectives

- Reduce manual administrative work.
- Centralize student and staff information.
- Digitize attendance and examination processes.
- Automate fee management and financial reporting.
- Improve parent-school communication.
- Maintain historical academic records.
- Provide secure role-based access.
- Support independent and multi-school deployments.
- Allow schools to configure their own operations.

## 1.3 Product Scope

The product includes eight user roles and the following major modules:

1. Super Administrator
2. School Administrator
3. Teacher
4. Parent
5. Student
6. Accountant
7. Librarian
8. Driver

---

# 2. Deployment Architecture

## 2.1 Deployment Models

The product must support two deployment models using the same application codebase.

### Model A: Cloud SaaS

- One centralized application serves multiple schools.
- Each school has logically isolated records.
- Users can belong to multiple schools.
- Platform-level Super Administrator controls school onboarding.
- Subscription and plan management are centrally controlled.
- Application updates are centrally deployed.

### Model B: Standalone Installation

- Individual school receives an independent deployment.
- Each installation maintains its own database.
- School data remains under that deployment's administrative control.
- No dependency on the central SaaS platform for routine school operations.
- The installation can operate using the same application modules.
- Controlled by `APP_MODE=standalone` (vs `APP_MODE=saas`), disabling SaaS-only platform/subscription routes and bootstrapping the initial School, School Administrator, default roles, and document sequences via a one-time CLI/install-token flow.

### Deployment design

| Component | SaaS | Standalone |
|---|---|---|
| Frontend | Central hosting | Independent hosting |
| Backend | Central hosting | Independent server |
| Database | Shared multi-tenant DB or dedicated tenant DB | Dedicated database |
| School isolation | Tenant authorization + database safeguards | Deployment boundary |
| Storage | Cloud or local | Local or cloud |
| Subscription | Platform managed | Optional independent licensing |
| Updates | Central deployment | Controlled upgrades |

A dedicated-school SaaS database may also be supported later as an enterprise deployment option.

## 2.2 Storage Architecture

Support two interchangeable storage adapters.

**Local storage**
- Files stored on the server's configured storage directory.
- Suitable for standalone installations.
- Configurable upload limits.
- Private file access through authenticated backend routes.

**Cloud object storage**
- Compatible with S3-compatible storage.
- Suitable for hosted SaaS deployments.
- Private buckets and signed download URLs.
- Configurable storage limits and retention policies.

The application must not depend directly on one storage provider.

All uploaded files must have database metadata, including:
- File ID
- School ID
- Original filename
- Storage key
- Storage provider (`local` | `s3`)
- Visibility (`private` | `public`, where `public` applies only to published website/branding assets)
- MIME type (validated via magic bytes; SVG and HTML uploads blocked)
- File size
- Uploader
- Related entity
- Creation timestamp

Private files must always be served with `Content-Disposition: attachment` or short-lived signed URLs.

---

# 3. Technology Stack

## 3.1 Frontend

- React
- Vite
- TypeScript
- Bootstrap 5
- React Router
- TanStack Query for server-state management
- React Hook Form
- Zod for validation
- Axios or a standardized Fetch API client
- Chart library for analytics

Requirements:
- Responsive interface.
- Reusable components.
- Role-aware navigation.
- Form validation.
- Accessible UI.
- Loading, error and empty states.
- Consistent dashboard layouts.

## 3.2 Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod
- Secure session authentication (PostgreSQL-backed sessions with CSRF protection)
- Background job processing (BullMQ + Redis)
- PDF & spreadsheet generation (`pdfkit` for receipts, ID cards, and report cards; `exceljs` for Excel/CSV exports)
- OpenAPI 3.1 documentation

## 3.3 Infrastructure

- Docker and Docker Compose.
- Reverse proxy with HTTPS.
- PostgreSQL database.
- Redis queue infrastructure in both SaaS and Standalone Compose stacks (single BullMQ job path).
- Local or cloud object storage.
- Automated database backups.
- Centralized application logs.
- Monitoring and error reporting.

## 3.4 Architecture Pattern

Use a modular monolith initially.

Each business module must have its own:
- Routes
- Controllers
- Services
- Validation schemas
- Database access logic
- Authorization policies
- Tests

Do not introduce microservices in the initial release. This keeps deployment, debugging and maintenance manageable.

---

# 4. User Roles and Permissions

## 4.1 Super Administrator

Platform-wide authority.

Responsibilities:
- Create and manage schools.
- Activate or deactivate schools.
- Manage SaaS subscriptions.
- Manage platform configurations.
- Monitor platform usage.
- Manage platform administrators.
- View platform-level analytics.
- Manage deployment and licensing controls.

The Super Administrator has no automatic need to access private student or financial records of every school. Such access should be separately audited and controlled.

## 4.2 School Administrator

Complete authority within their own school.

Responsibilities:
- Manage all school users.
- Create custom roles.
- Configure permissions.
- Manage students and guardians.
- Manage teachers and staff.
- Configure academic years.
- Manage attendance and examinations.
- Manage fees and accounting.
- Manage library, transport and hostel.
- Manage school website.
- View school reports.
- Configure school settings.

School Administrators must not access another school's data or platform-level settings.

## 4.3 Teacher

- View assigned classes.
- View assigned students.
- Mark student attendance.
- Manage assigned homework.
- Enter examination marks.
- View class timetables.
- Communicate with authorized parents.
- View permitted academic reports.

## 4.4 Parent

- View linked children's profiles.
- View attendance.
- View homework.
- View examination results.
- View timetables.
- View fee invoices and payment history.
- Submit leave requests.
- Receive school notifications.
- Communicate with authorized teachers.

## 4.5 Student

- View own profile.
- View attendance.
- View timetable.
- View homework.
- Submit assignments.
- Participate in online examinations.
- View published results.
- View permitted fee information.
- Receive notifications.

## 4.6 Accountant

- Manage fee structures.
- Generate invoices.
- Collect payments.
- Generate receipts.
- Manage refunds subject to authorization.
- Manage accounting records.
- Generate financial reports.

## 4.7 Librarian

- Manage book catalogue.
- Manage physical book copies.
- Issue and return books.
- Manage overdue records.
- Manage library fines.
- Generate library reports.

## 4.8 Driver

- View assigned routes.
- View assigned stops.
- View permitted student transport details.
- Record boarding and drop-off where enabled.
- Receive transport-related notifications.

## 4.9 Permission Rules

The permission system must support:

- View
- Create
- Update
- Archive
- Approve
- Reject
- Export
- Publish
- Manage

School Administrators receive all school-level permissions by default.

Other roles receive configurable permissions and record-level restrictions.

Scoping rules:
- Users can belong to multiple schools via `school_memberships`.
- `user_roles` must be scoped per `(user_id, school_id, role_id)` (via `school_membership_id`), never globally across schools.
- `sessions` store `active_school_id` (nullable for Super Admin platform mode) and support explicit school switching.
- Platform Super Admin authority is separate from school roles; any support access into a school requires an audited break-glass impersonation session with reason and expiry.

---

# 5. Functional Requirements

## Module 1: Platform and School Management

Features:
- School registration.
- School profile.
- School logo and branding.
- Academic configuration.
- School status management.
- Subscription management.
- Deployment configuration.
- School-specific settings.
- School onboarding wizard.

Acceptance criteria:
- Super Administrator can create schools.
- School Administrators can manage their own school settings.
- Schools cannot access one another's data.
- Academic configuration is maintained independently for each school.

## Module 2: Student Management

Features:
- Student admission.
- Student profiles.
- Admission numbers.
- Parent and guardian records.
- Student photographs.
- Document uploads.
- Medical and emergency information where authorized.
- Class and section allocation.
- Academic-year enrolment.
- Student promotion.
- Student transfer.
- Student archive and reactivation.
- Student ID cards.
- Admission reports.

Acceptance criteria:
- Admission numbers are unique within a school.
- Students can have multiple guardians.
- Students retain historical enrolment records.
- Promotion creates a new academic-year enrolment.
- Archived students remain available for historical reporting.

## Module 3: Teacher and Staff Management

Features:
- Employee registration.
- Employee ID.
- Department and designation.
- Teacher profiles.
- Qualifications.
- Experience.
- Employment status.
- Subject assignments.
- Class assignments.
- Staff attendance.
- Staff documents.
- Login account association.

Acceptance criteria:
- One staff member can have an associated user account.
- A staff member can have a teacher profile.
- Non-teaching employees do not require teacher profiles.
- Employment history is preserved.

## Module 4: Academic Management

Features:
- Academic years.
- Classes.
- Sections.
- Subjects.
- Class-subject assignments.
- Teacher assignments.
- Class teacher assignments.
- Academic configuration.
- Promotion rules.

Acceptance criteria:
- Academic years are school-specific.
- One academic year can be designated current per school.
- Subjects can be assigned differently across academic years.
- Class and section relationships are validated.

## Module 5: Attendance Management

Features:
- Student daily attendance.
- Period-wise attendance option.
- Staff attendance.
- Late arrival.
- Half-day attendance.
- Leave management.
- Attendance correction.
- Monthly attendance reports.
- Attendance percentage.
- Parent notifications.

Acceptance criteria:
- Duplicate attendance is prevented for the same student and session.
- Authorized users can correct attendance.
- Corrections are audited.
- Attendance reports can be filtered by date, class and academic year.

## Module 6: Timetable Management

Features:
- Period configuration.
- Class timetable.
- Teacher timetable.
- Room allocation.
- Break periods.
- Weekly scheduling.
- Timetable changes.
- Conflict detection.

Acceptance criteria:
- A section cannot have overlapping lessons.
- A teacher cannot teach two classes simultaneously.
- A room cannot be allocated to two lessons simultaneously.
- Timetable changes are reflected in relevant dashboards.

## Module 7: Examination Management

Features:
- Examination creation.
- Examination categories.
- Subject-wise examinations.
- Exam scheduling.
- Maximum and passing marks.
- Mark entry.
- Grade configuration.
- Report cards.
- Result publishing.
- Student performance reports.

Acceptance criteria:
- Marks cannot exceed maximum marks.
- Results can be published only by authorized users.
- Published results require controlled correction.
- Historical results remain available.

## Module 8: Online Examination

Features:
- Question banks.
- Multiple-choice questions.
- Multiple-select questions.
- True/false questions.
- Descriptive questions.
- Question randomization.
- Timed examinations.
- Autosave.
- Exam attempts.
- Automatic evaluation.
- Manual evaluation.
- Result publishing.

Acceptance criteria:
- Students cannot access correct answers before authorized release.
- Server-side examination timing is enforced.
- Submitted attempts cannot be modified by students.
- Descriptive questions support manual evaluation.
- Interrupted attempts follow configurable recovery rules.

## Module 9: Homework and Assignments

Features:
- Homework creation.
- Subject-wise assignments.
- Due dates.
- Attachments.
- Student submissions.
- Teacher feedback.
- Marks and evaluation.
- Parent visibility.

Acceptance criteria:
- Students only see assignments relevant to their enrolment.
- Submissions are timestamped.
- Teachers can evaluate authorized submissions.

## Module 10: Fee Management

Features:
- Fee categories.
- Fee structures.
- Student fee assignments.
- Installment schedules.
- Invoices.
- Discounts.
- Scholarships.
- Late fines.
- Payment collection.
- Partial payments.
- Multiple invoice allocations.
- Receipts.
- Refunds.
- Outstanding dues.
- Fee reminders.

Acceptance criteria:
- Fee templates can be changed without silently modifying existing student obligations.
- Payment allocation cannot exceed payment amount or outstanding invoice balance.
- Refunds cannot exceed refundable amounts.
- Receipts have unique school-level numbers.
- Every financial correction is auditable.

## Module 11: Accounting

Features:
- Chart of accounts.
- Income accounts.
- Expense accounts.
- Cash and bank accounts.
- Journal entries.
- Double-entry accounting.
- Ledger.
- Trial balance.
- Income statement.
- Balance sheet.
- Financial reports.
- Reversal entries.

Acceptance criteria:
- Every posted journal entry balances.
- Posted entries cannot be directly edited.
- Corrections use reversal and replacement entries.
- Financial reports reconcile with posted ledger entries.

## Module 12: Library Management

Features:
- Book categories.
- Book catalogue.
- ISBN.
- Authors and publishers.
- Physical copies.
- Accession numbers.
- Book issue and return.
- Due dates.
- Fines.
- Overdue reports.

Acceptance criteria:
- A physical copy cannot have multiple active issues.
- Book return updates copy availability.
- Overdue fines follow school configuration.

## Module 13: Transportation Management

Features:
- Vehicle records.
- Vehicle capacity.
- Driver records.
- Route creation.
- Route stops.
- Pickup and drop times.
- Student transport assignments.
- Transport fees.
- Transport attendance.
- Vehicle maintenance.

Future enhancement:
- Live GPS tracking.

Acceptance criteria:
- Students can only be assigned to valid routes and stops.
- Vehicle capacity is enforced.
- Driver access is limited to assigned transport records.

## Module 14: Hostel Management

Features:
- Hostel buildings.
- Rooms.
- Beds.
- Wardens.
- Student allocation.
- Vacating records.
- Occupancy reports.
- Hostel fee integration.

Acceptance criteria:
- A bed cannot have multiple active allocations.
- Room capacity cannot be exceeded.
- Historical allocations are retained.

## Module 15: Notifications and Messaging

Channels:
- In-app notifications.
- Email.
- SMS.
- Push notifications.
- Optional WhatsApp integration.

Features:
- Individual notifications.
- Class notifications.
- Parent notifications.
- Teacher communication.
- Message attachments.
- Read receipts.
- Notification templates.
- Delivery status.
- Retry handling.

Acceptance criteria:
- Notifications respect user authorization.
- Failed external delivery does not destroy the in-app notification.
- Delivery attempts are recorded.

## Module 16: Reports and Analytics

Reports:
- Student statistics.
- Admissions.
- Attendance.
- Examination performance.
- Fee collection.
- Outstanding fees.
- Financial reports.
- Library usage.
- Transport statistics.
- Hostel occupancy.
- Staff statistics.

Features:
- Date filters.
- Academic-year filters.
- Class and section filters.
- CSV export.
- Excel export.
- PDF export.
- Dashboard charts.

## Module 17: Dynamic School Website

Features:
- Home page.
- About school.
- Principal's message.
- Academic information.
- Admission information.
- Faculty information.
- Photo galleries.
- Announcements.
- Events.
- Contact page.
- SEO metadata.
- Navigation menu management.
- Page publishing.

Acceptance criteria:
- Schools can manage their own public website.
- Draft pages are not publicly visible.
- Published pages are accessible through school-specific URLs or configured domains.
- Public pages never expose private school records.

---

# 6. Database Architecture

## 6.1 Database Technology

PostgreSQL with Prisma ORM.

## 6.2 Database Design Principles

- UUID primary keys.
- Foreign-key constraints.
- Indexed search and filtering fields.
- `TIMESTAMPTZ` for event instants and audit timestamps; SQL `DATE` for operational calendar dates (attendance dates, exam dates, invoice due dates, holidays) interpreted in the school's timezone.
- `NUMERIC` for financial values.
- JSONB for flexible structured content where justified.
- Soft deletion (`deleted_at`) for appropriate business records, paired with PostgreSQL partial unique indexes (`WHERE deleted_at IS NULL`) so archived/deleted rows do not block active uniqueness.
- School-scoped atomic numbering via `document_sequences` for receipts, invoices, admission numbers, employee IDs, and journal numbers.
- Immutable financial transaction history.
- Academic-year-specific enrolment records.
- School-level tenant isolation.

## 6.3 Main Database Tables

### Platform
- users
- platform_roles
- schools
- school_memberships
- school_settings
- school_subscriptions
- subscription_plans

### Authentication and Permissions
- roles (school-scoped)
- permissions
- role_permissions
- user_roles (scoped to `school_membership_id`)
- sessions (includes `active_school_id`)
- password_reset_tokens
- user_mfa_methods
- mfa_recovery_codes

### Academic
- academic_years
- holidays
- classes
- sections
- subjects
- class_subjects (academic-year-scoped)
- class_teachers
- subject_teacher_assignments
- promotion_rules
- students
- guardians
- student_guardians
- student_enrollments
- student_documents
- student_promotions

### Staff
- staff
- staff_employment_history
- staff_documents
- departments
- designations
- teacher_profiles

### Attendance and Timetable
- attendance_sessions
- student_attendance
- staff_attendance
- leave_requests
- timetable_periods
- classrooms
- timetables
- timetable_entries

### Examination
- exams
- exam_subjects
- exam_schedules
- marks
- grade_scales
- grade_scale_rules
- exam_results
- question_banks
- questions
- question_options
- online_exams
- online_exam_questions
- exam_attempts
- exam_answers

### Homework
- homework
- homework_submissions

### Financial
- fee_types
- fee_structures
- fee_structure_items
- late_fee_rules
- student_fee_assignments
- student_fee_assignment_items
- fee_installments
- invoices
- invoice_items
- payments
- payment_allocations
- payment_refunds
- student_concessions
- accounting_periods
- accounts
- journal_entries
- journal_entry_lines

### Library
- library_policies
- book_categories
- books
- book_copies
- book_issues

### Transportation
- vehicles
- driver_profiles
- transport_routes
- route_stops
- route_assignments
- transport_assignments
- transport_attendance
- vehicle_maintenance

### Hostel
- hostels
- hostel_rooms
- hostel_beds
- hostel_allocations

### Communication
- notifications
- notification_recipients
- notification_deliveries
- notification_templates
- messages
- message_recipients
- message_attachments

### System
- attachments
- audit_logs
- document_sequences
- idempotency_keys
- system_settings

### Website
- website_settings
- website_pages
- website_menus
- website_announcements
- website_events
- website_galleries
- website_gallery_items

## 6.4 Tenant Isolation

Every school-owned record must be linked to its school.

Required safeguards:
1. School membership validation.
2. Backend tenant-scoped database queries via a mandatory Prisma `forTenant(schoolId)` client extension.
3. Composite foreign keys `(school_id, entity_id)` for school ownership from Phase 0.
4. PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`, non-owner runtime DB role, and `SET LOCAL app.current_school_id` inside `prisma.$transaction`) added in Phase 6 hardening.
5. Automated cross-tenant isolation tests.

The database must prevent a student from School A being linked to an enrolment, fee record or attendance record belonging to School B.

## 6.5 Academic History

Student identity and academic enrolment must remain separate.

A student can have different enrolments across academic years without overwriting previous class, section, attendance or examination history.

## 6.6 Financial Integrity

- Payment and allocation operations must be transactional.
- Posted journal entries must be balanced.
- Refunds must reference original payments.
- Financial records must not be physically deleted through normal application operations.
- Financial corrections must create traceable adjustment or reversal records.

---

# 7. API Architecture

Base path:

`/api/v1`

Use REST APIs with JSON requests and responses.

## Main API Groups

| Group | Base route |
|---|---|
| Public Website | /public |
| Platform (SaaS) | /platform |
| Authentication | /auth |
| Schools | /schools |
| Users | /users |
| Roles | /roles |
| Permissions | /permissions |
| Settings | /settings |
| Dashboard | /dashboard |
| Files | /files |
| Audit Logs | /audit-logs |
| Students | /students |
| Staff | /staff |
| Teachers | /teachers |
| Academics | /academic |
| Attendance | /attendance |
| Leave | /leave-requests |
| Timetable | /timetable |
| Examinations | /exams |
| Online exams | /online-exams |
| Homework | /homework |
| Fees | /fees |
| Invoices | /invoices |
| Payments | /payments |
| Accounting | /accounting |
| Library | /library |
| Transport | /transport |
| Hostel | /hostel |
| Notifications | /notifications |
| Messages | /messages |
| Reports | /reports |
| Website | /website |

## API Standards

- OpenAPI 3.1 documentation.
- Consistent error responses.
- Pagination.
- Filtering.
- Sorting.
- Input validation.
- Rate limiting.
- Authentication middleware.
- Permission middleware.
- Tenant isolation middleware.
- Request logging.
- Idempotency for sensitive financial operations.

---

# 8. UI/UX Requirements

## 8.1 General Design

- Responsive Bootstrap 5 layout.
- Professional administrative dashboard.
- Sidebar navigation.
- Top navigation bar.
- Breadcrumbs.
- Search and filters.
- Reusable tables.
- Modal forms where appropriate.
- Notification center.
- Profile and account menu.
- Responsive mobile navigation.

## 8.2 Dashboard Requirements

### Super Administrator Dashboard
- Total schools.
- Active schools.
- Inactive schools.
- Subscription statistics.
- Platform usage.
- System health.

### School Administrator Dashboard
- Total students.
- Total staff.
- Today's attendance.
- Fee collection.
- Pending fees.
- Examination statistics.
- Recent activities.
- Upcoming events.

### Teacher Dashboard
- Assigned classes.
- Today's timetable.
- Attendance tasks.
- Homework.
- Upcoming examinations.

### Parent Dashboard
- Linked children.
- Attendance summaries.
- Homework.
- Examination results.
- Outstanding fees.
- Notifications.

### Student Dashboard
- Timetable.
- Attendance.
- Homework.
- Examinations.
- Results.
- Notifications.

### Accountant Dashboard
- Daily collections.
- Pending invoices.
- Outstanding dues.
- Refunds.
- Financial summaries.

### Librarian Dashboard
- Total books.
- Available copies.
- Issued books.
- Overdue books.

### Driver Dashboard
- Assigned vehicle.
- Route details.
- Stops.
- Assigned students.
- Transport tasks.

---

# 9. Security Requirements

## Authentication
- Secure password hashing using Argon2id or an equivalent approved password-hashing algorithm.
- HTTP-only secure cookies.
- CSRF protection.
- Session expiry and revocation.
- Password reset tokens with expiry.
- Optional multi-factor authentication.

## Authorization
- Role-based access control.
- Permission-level authorization.
- School membership validation.
- Record-level access checks.
- Parent-child relationship validation.

## Data Security
- HTTPS.
- Secure secrets management.
- Database access restrictions.
- Private file storage.
- Signed download links.
- Input validation.
- Protection against SQL injection.
- Protection against XSS and CSRF.
- Rate limiting.
- Audit logging.

## Sensitive Operations
- Fee refunds.
- Financial adjustments.
- Examination result publication.
- Permission changes.
- Student record transfers.
- User deactivation.

These operations must be audited.

---

# 10. Non-Functional Requirements

## Performance Targets

Initial engineering targets, subject to load testing:

- Normal API read requests: p95 under 500 ms.
- Normal API write requests: p95 under 800 ms.
- Dashboard initial data: under 2 seconds for typical datasets.
- Paginated tables rather than unbounded data retrieval.
- Background processing for large exports and bulk notifications.

## Scalability
- Stateless application servers where possible.
- Database connection pooling.
- Indexed queries.
- Background job processing.
- Object storage for uploaded documents.
- Cache only where justified by measured performance.

## Reliability
- Automated backups.
- Restore testing.
- Health checks.
- Error logging.
- Monitoring.
- Graceful job retries.
- Database migration tracking.

## Availability
- Target 99.5% monthly availability for the hosted SaaS initial production service, excluding agreed maintenance windows. This is a target, not an existing guarantee.

## Localization
- Initial language: English.
- Timezone default: Asia/Kolkata.
- Currency default: INR.
- Support for configurable school timezones and currencies.
- Future multilingual interface support.

---

# 11. Testing Strategy

## Unit Testing
- Business rules.
- Validation.
- Financial calculations.
- Permission checks.
- Utility functions.

## Integration Testing
- API and database operations.
- Authentication.
- School membership.
- Payment transactions.
- Examination workflows.
- File uploads.

## Security Testing
- Cross-tenant access attempts.
- Unauthorized API access.
- Privilege escalation.
- File access control.
- Session security.
- Input validation.

## End-to-End Testing
- Student admission.
- Promotion.
- Attendance.
- Examination.
- Fee collection.
- Book issue and return.
- Transport assignment.
- Parent portal.

## Performance Testing
- Concurrent user simulation.
- Large student datasets.
- Bulk attendance.
- Report generation.
- Database query performance.

---

# 12. Development Roadmap

The product should be developed in controlled phases. Do not attempt to implement all modules simultaneously.

## Phase 0 — Foundation and Engineering Setup

Tasks:
- Repository initialization.
- Frontend and backend setup.
- TypeScript configuration.
- Docker environment.
- PostgreSQL setup.
- Prisma initialization.
- Authentication architecture.
- Tenant isolation architecture.
- Error handling.
- Logging.
- API documentation.
- CI checks.

Deliverable: Working application foundation.

## Phase 1 — Platform and Core Administration

Tasks:
- School management.
- User management.
- Authentication.
- Roles and permissions.
- Academic years.
- Student admission.
- Guardian management.
- Teacher and staff management.
- Classes and sections.
- Subjects.

Deliverable: Functional core School ERP.

## Phase 2 — Academic Operations

Tasks:
- Student attendance.
- Staff attendance.
- Leave management.
- Timetable.
- Subject assignments.
- Examinations.
- Results.
- Homework.
- Student promotion.

Deliverable: Complete academic management system.

## Phase 3 — Financial Management

### Phase 3A: Fee Core (Included in MVP)
Tasks:
- Fee types.
- Fee structures.
- Student fee assignments.
- Installments.
- Invoices.
- Payments.
- Receipts (`pdfkit`).
- Discounts and late fines.
- Refunds.

Deliverable: Operational fee billing and collection.

### Phase 3B: Double-Entry Accounting (Post-MVP)
Tasks:
- Accounting periods and fiscal years.
- Chart of accounts.
- Automated fee-to-ledger posting.
- Journal entries and reversal entries.
- Financial reports (Trial Balance, Income Statement, Balance Sheet).

Deliverable: Financially reconciled general ledger.

## Phase 4 — Supporting School Modules

Tasks:
- Library.
- Transportation.
- Hostel.
- Notifications (async deliveries + retries).
- Messaging.
- Attachments.
- Audit logs.

Deliverable: Extended school administration system.

## Phase 5 — Portals and Advanced Features

### Phase 5A: MVP Portals & Essential Reports (Included in MVP)
Tasks:
- Aggregated role dashboards.
- Parent and student read-only portals.
- Essential reports (attendance, fees, exam results) with CSV/Excel/PDF export.

Deliverable: Complete MVP release (`Phase 0 -> 1 -> 2 -> 3A -> 5A`).

### Phase 5B: Remaining Portals & Advanced Modules (Post-MVP)
Tasks:
- Teacher, accountant, librarian, and driver dedicated portals.
- Online examinations.
- Dynamic school website (`/public`).
- Advanced cross-module analytics.

Deliverable: Complete role-based ERP experience.

## Phase 6 — SaaS and Standalone Deployment

Tasks:
- SaaS onboarding.
- Subscription plans.
- PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY` + `SET LOCAL`) and school isolation verification.
- Standalone installation package (`APP_MODE=standalone` + bootstrap CLI).
- Local storage adapter.
- Cloud storage adapter.
- Configuration management.
- Upgrade and migration process.
- Backup and restore.
- Deployment documentation.

Deliverable: Both deployment models operational.

## Phase 7 — Quality Assurance and Production Release

Tasks:
- Full integration tests.
- Security tests.
- Cross-tenant tests.
- Performance tests.
- Data recovery tests.
- Browser and mobile responsiveness.
- Documentation.
- Production deployment.

Deliverable: Production-ready release.

## Indicative Schedule

For a small experienced development team:

| Phase | Estimated duration |
|---|---:|
| Foundation | 2 weeks |
| Core administration | 3–4 weeks |
| Academic operations | 3–4 weeks |
| Financial management | 3–4 weeks |
| Supporting modules | 2–3 weeks |
| Portals and advanced features | 3–4 weeks |
| Deployment and QA | 2–3 weeks |

**Indicative total: approximately 18–24 weeks.**

This estimate assumes a small team and phased delivery. A solo developer should expect a longer schedule, particularly for accounting, online examinations, multi-tenant security and production deployment.

---

# 13. MVP Definition

The first usable release should not contain every advertised feature.

## MVP — Essential Features

- Authentication.
- School management.
- User roles.
- Student admission.
- Guardian management.
- Teacher management.
- Classes and sections.
- Subjects.
- Student attendance.
- Staff attendance.
- Timetable.
- Examination and results.
- Basic homework.
- Fee structures.
- Invoices.
- Payment collection.
- Receipts.
- Basic reports.
- Parent and student read-only portals.

The first MVP should prove that the complete school administration workflow works correctly before expanding into advanced features.

---

# 14. Future Enhancements

Possible future additions:

- Mobile applications.
- Live GPS tracking.
- Biometric attendance integration.
- RFID student identification.
- Payment gateway integration.
- UPI payment reconciliation.
- Advanced analytics.
- AI-assisted reporting.
- Automated parent communication.
- Online admission applications.
- Digital certificates.
- Library barcode scanning.
- Multi-language support.
- Advanced examination proctoring.

These are not required for the initial release.

---

# 15. Definition of Done

A module is not considered complete merely because its interface exists.

Every module must have:

1. Database schema and migrations.
2. Backend APIs.
3. Validation rules.
4. Authorization checks.
5. Tenant isolation.
6. Frontend screens.
7. Loading and error states.
8. Unit tests.
9. Integration tests.
10. Audit handling where necessary.
11. API documentation.
12. Acceptance tests.

---

# 16. Final Technical Decisions

| Area | Decision |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express + TypeScript |
| UI | Bootstrap 5 |
| Database | PostgreSQL |
| ORM | Prisma |
| API | REST / JSON |
| API documentation | OpenAPI 3.1 |
| Authentication | Secure server-managed sessions |
| Authorization | RBAC + record-level permissions |
| Architecture | Modular monolith |
| SaaS tenancy | Multi-tenant |
| Standalone | Independent deployment and database |
| File storage | Local + S3-compatible object storage |
| PDF / Exports | `pdfkit` (PDF) + `exceljs` (Excel/CSV) |
| Containerization | Docker |
| Background jobs | BullMQ + Redis (both SaaS and Standalone) |
| Testing | Unit + integration + E2E + security |
| Documentation | Markdown |

---

# 17. Final Product Acceptance Criteria

The School ERP can be considered ready for its initial production release when:

- All eight roles can authenticate and access authorized dashboards.
- School Administrators have complete authority within their school.
- Super Administrators can manage the SaaS platform.
- Multiple schools can operate without cross-tenant data exposure.
- Standalone installations work independently.
- Local and cloud document storage both work.
- Student admission and academic promotion work.
- Attendance and examination workflows work.
- Fee collection and accounting remain financially consistent.
- Parent and student portals enforce ownership restrictions.
- Audit logs record sensitive actions.
- Backups can be restored successfully.
- Critical security and integration tests pass.
- Installation and deployment documentation is complete.

---

# Conclusion

This PRD establishes the functional and technical baseline for building a complete School Management System.

The system will use one modular codebase that supports both multi-school SaaS and standalone school deployments. Its foundation will prioritize data isolation, academic history, financial integrity, role-based permissions and maintainability.

**Implementation should begin with Phase 0 and Phase 1.** Do not build every module at once, and do not treat a visually complete interface as evidence that a business workflow is complete.
