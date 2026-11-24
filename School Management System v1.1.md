# School Management System (School ERP) — Product Requirements Document (PRD)

**Version:** 1.1  
**Status:** Accepted — baseline for Phase 1+ implementation (open decisions in §19 closed; Phase 0 tech lock-ins aligned)  
**Date:** 25 November 2026  
**Supersedes:** v1.0 (25 November 2026)  
**Product Type:** Multi-Tenant School ERP + Standalone School Management Software

### Document conventions

- **MUST / SHOULD / MAY** carry their usual requirement meanings (MUST = mandatory, SHOULD = strongly recommended, MAY = optional).
- Every module has an ID (`M01`–`M19`). Acceptance criteria are numbered `Mxx-ACn` so tests, tickets and release notes can trace back to them.
- Each module header states its delivery **Phase** (see §12) and its **MVP** status (see §13).
- Tables marked † in §6.3 are new in v1.1. A change log mapping every v1.0 finding to its resolution is in Appendix B.

---

## 1. Product Overview

### 1.1 Product Vision

Build a comprehensive, scalable and secure School Management System that digitizes school administration, academic operations, financial management, communication and institutional reporting.

The system MUST support:

1. Multiple schools operating through a centralized cloud SaaS platform.
2. Independent standalone installations for individual schools.
3. Configurable modules (per-school feature enablement) and permissions.
4. Responsive interfaces for desktop, tablet and mobile browsers.
5. Long-term academic and financial record management.

The application provides a unified platform for administrators, teachers, parents, students, accountants, librarians and drivers, plus hostel wardens through a pre-seeded role template.

### 1.2 Product Objectives

- Reduce manual administrative work.
- Centralize student and staff information.
- Digitize attendance and examination processes.
- Automate fee management and financial reporting.
- Improve parent-school communication.
- Maintain historical academic records.
- Provide secure role-based access.
- Support independent and multi-school deployments.
- Allow schools to configure their own operations.
- Ease adoption through bulk data import and complete data export.

### 1.3 Product Scope

**User roles (eight primary roles):**

1. Super Administrator
2. School Administrator
3. Teacher
4. Parent
5. Student
6. Accountant
7. Librarian
8. Driver

A **Hostel Warden** is supported as a pre-seeded, configurable role template (see §4.8).

**Major modules:**

| ID | Module |
|---|---|
| M01 | Platform and School Management |
| M02 | Student Management (including certificates) |
| M03 | Teacher and Staff Management |
| M04 | Academic Management (including terms, calendar and electives) |
| M05 | Attendance and Leave Management |
| M06 | Timetable Management |
| M07 | Examination Management |
| M08 | Online Examination |
| M09 | Homework and Assignments |
| M10 | Fee Management |
| M11 | Accounting |
| M12 | Library Management |
| M13 | Transportation Management |
| M14 | Hostel Management |
| M15 | Notifications and Messaging |
| M16 | Reports and Analytics |
| M17 | Dynamic School Website |
| M18 | Data Import, Export and Offboarding |
| M19 | Configuration, Numbering and Integrations |

### 1.4 Out of Scope for the Initial Release

- Online payment gateway collection (parents view invoices and receipts; payments are recorded by staff using offline modes in v1).
- Native mobile applications (the web application is responsive; web push may be offered).
- Live GPS tracking, biometric/RFID integration, library barcode scanning.
- Online admission applications, advanced exam proctoring, AI-assisted reporting.
- Multi-language user interface (the UI MUST be built i18n-ready; only English ships).

### 1.5 Success Metrics (targets to validate with pilot schools)

| Metric | Target |
|---|---|
| Daily attendance marked for a typical section | under 2 minutes |
| Fee receipt generation after payment entry | under 30 seconds end-to-end |
| Pilot school completes onboarding (data import to first attendance) | within 5 working days |
| Cross-tenant data exposure incidents | 0 |
| Month-end financial reports reconcile with ledger/payments | 100% |
| Pilot school staff weekly active usage | at least 80% of teachers |

### 1.6 Assumptions

- Initial market is India (default timezone Asia/Kolkata, default currency INR); other timezones and currencies are configurable per school.
- Schools are K-12 institutions with an annual academic year, optionally divided into terms.
- Fee payments are collected by school staff in v1.
- A school has one primary currency.
- Standalone customers may have limited IT support; installation MUST be achievable through Docker Compose and documented steps.

---

## 2. Deployment Architecture

### 2.1 Deployment Models

The product MUST support two deployment models using the same application codebase.

#### Model A: Cloud SaaS

- One centralized application serves multiple schools.
- Each school has logically isolated records.
- Users can belong to multiple schools; each session operates in exactly one **active school context** (see §2.3).
- Platform-level Super Administrator controls school onboarding.
- Subscription, plan and feature-limit management are centrally controlled.
- Application updates are centrally deployed.

#### Model B: Standalone Installation

- An individual school receives an independent deployment.
- Each installation maintains its own database.
- School data remains under that deployment's administrative control.
- No dependency on the central SaaS platform for routine school operations, including licence validation (see §2.4).
- The installation uses the same application modules.

#### Deployment design

| Component | SaaS | Standalone |
|---|---|---|
| Frontend | Central hosting | Independent hosting |
| Backend | Central hosting | Independent server |
| Database | Shared multi-tenant DB (initial release) | Dedicated database |
| School isolation | Tenant authorization + database safeguards | Deployment boundary |
| Storage | Cloud object storage (local optional) | Local or cloud |
| Subscription | Platform managed | Optional independent licensing |
| Updates | Central deployment | Controlled upgrades |
| Platform administrator | Super Administrator (platform team) | Installation Owner (see §2.4) |

A dedicated-database-per-school SaaS option is **deferred** to a later enterprise release. The initial release supports only the shared multi-tenant database for SaaS.

### 2.2 Storage Architecture

Support two interchangeable storage adapters behind one interface. The application MUST NOT depend directly on one storage provider.

**Local storage**
- Files stored in the server's configured storage directory.
- Suitable for standalone installations.
- Configurable upload limits.
- Private file access through authenticated backend routes.

**Cloud object storage**
- Compatible with S3-compatible storage.
- Suitable for hosted SaaS deployments.
- Private buckets and signed, short-lived download URLs.
- Configurable storage limits and retention policies.

All uploaded files MUST have database metadata, including:
- File ID
- School ID
- Original filename
- Storage key
- MIME type (validated server-side, not trusted from the client)
- File size
- Checksum (SHA-256)
- Malware-scan status
- Visibility / access policy
- Uploader
- Related entity
- Creation timestamp
- Soft-deletion timestamp

The local storage adapter and file metadata are delivered in **Phase 0** because Phase 1 features (student photographs, documents, staff documents) require them.

### 2.3 Multi-School Users and Session Context

- A user identity (`users`) is global in SaaS; membership in each school is represented by `school_memberships`.
- User email addresses are unique platform-wide in SaaS and unique per installation in standalone.
- After login, a user with more than one membership MUST select an active school; the session stores that context. All tenant-scoped queries use the active school only.
- Switching schools MUST re-evaluate permissions and clear cached school-scoped state.
- A parent whose children attend different schools sees one school context at a time.

### 2.4 Standalone Platform Role and Licensing

- A standalone installation contains exactly one school record created by the installer.
- The first account created during installation is the **Installation Owner**. It holds School Administrator authority plus installation-level settings (backups, storage, licence). It has no cross-school powers because only one school exists.
- Optional licensing MUST work offline (signed licence file validated locally). Licence expiry MUST NOT delete or lock data; it may restrict creation of new records after a documented grace period.
- Standalone installations MAY enable all modules; module enablement is controlled by the licence or by configuration.

### 2.5 Module Configuration (Feature Flags)

- Each school has a set of enabled modules (`school_modules`).
- In SaaS, available modules and usage limits (students, staff, storage, messages) derive from the school's subscription plan (`plan_features`).
- Disabled modules MUST be hidden from navigation and rejected by the API.
- Disabling a module MUST NOT delete its data.

---

## 3. Technology Stack

Items marked **(confirm)** are recommended defaults that must be ratified in §19.

### 3.1 Frontend

- React
- Vite
- TypeScript
- Bootstrap 5
- React Router
- TanStack Query for server-state management
- React Hook Form
- Zod for validation
- Standardized Fetch API client wrapper (single client with error normalization, CSRF handling and retries)
- Chart library for analytics: Recharts (decided in §19 D1)
- i18n framework (for example `i18next`) wired from day one, with English as the only shipped language

Requirements:
- Responsive interface.
- Reusable components.
- Role-aware navigation.
- Form validation shared with backend schemas where practical.
- Accessible UI (target WCAG 2.1 AA).
- Loading, error and empty states.
- Consistent dashboard layouts.
- Supported browsers: latest two stable versions of Chrome, Edge, Firefox and Safari; mobile Safari and Chrome on current and previous major OS versions.

**Public website rendering.** The Vite single-page application is used for authenticated portals. The public school website (M17) requires SEO metadata, social previews and fast first paint, which a client-rendered SPA does not provide reliably. Public pages MUST therefore be server-rendered or pre-rendered by the backend and served separately from the SPA (decided in §19 D4).

### 3.2 Backend

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod
- Secure server-managed session authentication
- Background job processing (see §3.3)
- OpenAPI 3.1 documentation generated from the Zod schemas where practical
- PDF & export generation: `pdfkit` for receipts, report cards, ID cards and certificates; `exceljs` for Excel/CSV exports (decided in §19 D3)

### 3.3 Infrastructure

- Docker and Docker Compose.
- Reverse proxy with HTTPS.
- PostgreSQL database.
- Background job queue: BullMQ + Redis 7 in both SaaS and Standalone Compose stacks (single queue code path implemented in Phase 0; §19 D2).
- Local or cloud object storage.
- Automated, encrypted database backups with documented restore procedure.
- Centralized application logs.
- Monitoring and error reporting.
- Health check endpoints.

### 3.4 Architecture Pattern

Use a modular monolith initially.

Each business module MUST have its own:
- Routes
- Controllers
- Services
- Validation schemas
- Database access logic
- Authorization policies
- Tests

Do not introduce microservices in the initial release. This keeps deployment, debugging and maintenance manageable.

### 3.5 External Providers

Providers are accessed through adapters so they can be swapped per deployment:

| Capability | Requirement |
|---|---|
| Email | SMTP or API-based provider adapter |
| SMS | Provider adapter; for India, commercial SMS requires regulatory sender and template registration (DLT) — verify current requirements before launch |
| WhatsApp (optional) | Business API adapter with pre-approved templates |
| Web push (optional) | Standards-based web push; per-device token records |

Provider credentials are stored per school (`school_integrations`), encrypted at rest and never returned by the API.

---

## 4. User Roles and Permissions

### 4.1 Super Administrator (Platform)

Platform-wide authority.

Responsibilities:
- Create and manage schools.
- Activate or deactivate schools.
- Manage SaaS subscriptions and plan features.
- Manage platform configurations.
- Monitor platform usage.
- Manage platform administrators (additional platform-level accounts with a restricted subset of platform permissions, held in `platform_admins`).
- View platform-level analytics (aggregate only).
- Manage deployment and licensing controls.

The Super Administrator has **no standing access** to private student or financial records of any school. Any such access (for support or investigation) MUST use a time-limited, school-approved or break-glass **support access grant** (`support_access_grants`), MUST be recorded in the platform audit log, and MUST be visible to the school's administrators.

### 4.2 School Administrator

Complete authority within their own school.

Responsibilities:
- Manage all school users.
- Create custom roles.
- Configure permissions.
- Manage students and guardians.
- Manage teachers and staff.
- Configure academic years, terms and the school calendar.
- Manage attendance and examinations.
- Manage fees and accounting.
- Manage library, transport and hostel.
- Manage school website.
- Import and export school data.
- View school reports.
- Configure school settings, numbering formats and integrations.

School Administrators MUST NOT access another school's data or platform-level settings.

### 4.3 Teacher

- View assigned classes and subjects.
- View assigned students.
- Mark student attendance.
- Manage assigned homework.
- Enter examination marks for assigned subjects.
- View class and personal timetables.
- Communicate with authorized parents (authorization defined below).
- View permitted academic reports.

**Authorized parent communication:** a teacher may message a parent only where the teacher is the class teacher or a subject teacher of at least one of that parent's linked children in the current academic year. Schools may widen or narrow this by permission.

### 4.4 Parent

- View linked children's profiles.
- View attendance.
- View homework.
- View examination results (once published).
- View timetables.
- View fee invoices, receipts and payment history (payment itself is not available online in v1).
- Submit leave requests for linked children.
- Receive school notifications.
- Communicate with authorized teachers.

### 4.5 Student

- View own profile.
- View attendance.
- View timetable.
- View homework.
- Submit assignments.
- Participate in online examinations.
- View published results.
- View permitted fee information.
- Receive notifications.

### 4.6 Accountant

- Manage fee structures.
- Generate invoices.
- Collect payments (cash, cheque, bank transfer, UPI and other configured modes).
- Generate receipts.
- Request refunds and apply discounts; approval follows the approval rules in M10.
- Manage accounting records.
- Generate financial reports.

### 4.7 Librarian

- Manage book catalogue.
- Manage physical book copies.
- Issue and return books.
- Manage overdue records.
- Manage library fines.
- Generate library reports.

### 4.8 Driver

- View assigned vehicle, routes and stops.
- View permitted student transport details (name, stop, guardian contact only as configured).
- Record boarding and drop-off where enabled.
- Receive transport-related notifications.

**Hostel Warden (role template).** Pre-seeded configurable role that can manage hostel allocations, view occupancy, record vacating, and view the minimum student information needed for the hostel. A warden is a staff member with this role assigned. School Administrators can modify the template.

### 4.9 Permission Rules

The permission system MUST support the following actions per resource:

- View
- Create
- Update
- Archive
- Approve
- Reject
- Export
- Publish
- Manage

Rules:
- School Administrators receive all school-level permissions by default.
- Other roles receive configurable permissions and record-level restrictions (own children, assigned classes, assigned routes, own records).
- System roles are global templates; school-specific custom roles are copied or created per school and cannot exceed the permissions of the user creating them.
- Permission changes take effect on the user's next request and are audited.
- There is no hard-delete permission in normal operation; "Archive" replaces deletion.

### 4.10 Default Permission Matrix

Access levels: **F** = full within school, **A** = assigned records only, **O** = own/linked records only, **R** = read-only, **—** = none. Schools can adjust everything except the School Administrator column.

| Module | School Admin | Teacher | Parent | Student | Accountant | Librarian | Driver | Warden |
|---|---|---|---|---|---|---|---|---|
| M02 Students | F | A (R) | O (R) | O (R) | R (limited) | R (limited) | A (R, limited) | A (R, limited) |
| M03 Staff | F | O (R) | — | — | — | — | O (R) | O (R) |
| M04 Academic setup | F | R | — | — | — | — | — | — |
| M05 Attendance | F | A | O (R) | O (R) | — | — | — | — |
| M05 Leave | F (approve) | A (approve, if enabled) | O (submit) | — | — | — | — | — |
| M06 Timetable | F | R / O | O (R) | O (R) | — | — | — | — |
| M07 Exams | F (publish) | A (marks) | O (R, published) | O (R, published) | — | — | — | — |
| M08 Online exams | F | A | — | O | — | — | — | — |
| M09 Homework | F | A | O (R) | O (submit) | — | — | — | — |
| M10 Fees | F | — | O (R) | O (R, if enabled) | F (refund/discount per approval rules) | — | — | — |
| M11 Accounting | F | — | — | — | F | — | — | — |
| M12 Library | F | — | — | O (R) | — | F | — | — |
| M13 Transport | F | — | O (R) | O (R) | — | — | A | — |
| M14 Hostel | F | — | O (R) | O (R) | — | — | — | F |
| M15 Messaging | F | A | O | O (if enabled) | A | A | A | A |
| M16 Reports | F | A | — | — | Finance reports | Library reports | — | Occupancy |
| M17 Website | F | — | — | — | — | — | — | — |
| M18 Import/Export | F | — | — | — | — | — | — | — |
| M19 Configuration | F | — | — | — | — | — | — | — |

---

## 5. Functional Requirements

### M01 — Platform and School Management
**Phase:** 0–1 (SaaS onboarding and plans: Phase 6) | **MVP:** Partial (school profile, settings, status)

Features:
- School registration.
- School profile.
- School logo and branding.
- Academic configuration.
- School status management (active, suspended, deactivated).
- Subscription and plan management (SaaS).
- Deployment configuration.
- School-specific settings (timezone, currency, locale, working days).
- Module enablement and plan limits (feature flags).
- School onboarding wizard.
- Platform administrator management.

Acceptance criteria:
- M01-AC1: Super Administrator can create schools.
- M01-AC2: School Administrators can manage their own school settings.
- M01-AC3: Schools cannot access one another's data.
- M01-AC4: Academic configuration is maintained independently for each school.
- M01-AC5: Disabled modules are inaccessible through both UI and API, and their data is retained.
- M01-AC6: Deactivating a school blocks logins for that school but preserves all data.

### M02 — Student Management
**Phase:** 1 (promotion, transfer and certificates: Phase 2) | **MVP:** Yes

Features:
- Student admission.
- Student profiles.
- Admission numbers (configurable format, generated by numbering sequences).
- Parent and guardian records (guardian entity separate from the student).
- Optional student login accounts; guardian login accounts linked to guardian records.
- Student photographs.
- Document uploads.
- Medical and emergency information where authorized (encrypted at rest; access-logged).
- Class and section allocation.
- Academic-year enrolment.
- Student promotion.
- Student transfer (see definitions below).
- Student archive and reactivation.
- Student ID cards (template-based PDF generation, QR code optional).
- Certificates: Transfer Certificate and bonafide/study certificate (template-based, numbered, audited).
- Admission reports.

**Transfer definitions.**
- *Internal transfer:* change of section or class within the same academic year; creates a new enrolment record and closes the previous one.
- *Withdrawal / transfer out:* student leaves the school; enrolment closed, status set, Transfer Certificate may be issued; record is retained.
- *Cross-school transfer (SaaS):* NOT automatic. A school may export a student's record package; the receiving school creates a new student record. No data is shared across tenants without explicit export/import.

Acceptance criteria:
- M02-AC1: Admission numbers are unique within a school.
- M02-AC2: Students can have multiple guardians; each guardian can be linked to multiple students (siblings).
- M02-AC3: Students retain historical enrolment records.
- M02-AC4: Promotion creates a new academic-year enrolment and never alters the previous one.
- M02-AC5: Archived students remain available for historical reporting.
- M02-AC6: Medical and emergency data is visible only to roles with explicit permission, and each view is logged.
- M02-AC7: Issued certificates have unique school-level numbers and cannot be edited after issue (re-issue creates a new numbered record).

### M03 — Teacher and Staff Management
**Phase:** 1 | **MVP:** Yes

Features:
- Employee registration.
- Employee ID (generated by numbering sequences).
- Department and designation.
- Teacher profiles.
- Qualifications.
- Experience.
- Employment status and employment history (joining, role change, suspension, resignation).
- Subject assignments.
- Class assignments and class teacher assignments.
- Staff attendance (see M05).
- Staff documents.
- Login account association.

Acceptance criteria:
- M03-AC1: One staff member can have an associated user account.
- M03-AC2: A staff member can have a teacher profile.
- M03-AC3: Non-teaching employees do not require teacher profiles.
- M03-AC4: Employment history is preserved; changes append history rows rather than overwrite.
- M03-AC5: Drivers and wardens are staff records with the corresponding role assigned.

### M04 — Academic Management
**Phase:** 1 | **MVP:** Yes

Features:
- Academic years.
- Academic terms / semesters (optional per school).
- School calendar: holidays, working days, events and exam periods.
- Classes.
- Sections.
- Subjects.
- Class-subject assignments.
- Elective and optional subject groups, and student-subject enrolment.
- Teacher assignments (subject-teacher per section and academic year).
- Class teacher assignments.
- Academic configuration.
- Promotion rules (minimum result, outstanding-dues policy: allow, warn or block, as configured).

Acceptance criteria:
- M04-AC1: Academic years are school-specific.
- M04-AC2: Exactly one academic year can be designated current per school (database-enforced).
- M04-AC3: Subjects can be assigned differently across academic years.
- M04-AC4: Class and section relationships are validated.
- M04-AC5: Holidays defined in the calendar are excluded from attendance requirements and working-day calculations.
- M04-AC6: A student can be enrolled only in subjects valid for their class and academic year.
- M04-AC7: Terms of a year do not overlap and fall within the academic year's dates.

### M05 — Attendance and Leave Management
**Phase:** 2 | **MVP:** Yes (parent notifications use in-app channel only)

Features:
- Student daily attendance.
- Period-wise attendance option.
- Staff attendance.
- Late arrival.
- Half-day attendance.
- Leave types and leave balances (staff).
- Leave requests and approval (student leave submitted by guardians; staff leave submitted by staff).
- Attendance correction with reason.
- Monthly attendance reports.
- Attendance percentage.
- Parent notifications for absence (in-app in MVP; external channels in Phase 4).

Acceptance criteria:
- M05-AC1: Duplicate attendance is prevented for the same student and session (database unique constraint).
- M05-AC2: Authorized users can correct attendance.
- M05-AC3: Every correction records previous value, new value, user, time and reason in the audit log.
- M05-AC4: Attendance reports can be filtered by date, class and academic year.
- M05-AC5: Approved leave pre-fills attendance status but remains editable by authorized users.
- M05-AC6: Attendance dates use the school's timezone.
- M05-AC7: Bulk attendance for a section of 60 students saves in a single request and is idempotent.

### M06 — Timetable Management
**Phase:** 2 | **MVP:** Yes

Features:
- Period configuration.
- Class timetable.
- Teacher timetable.
- Room allocation.
- Break periods.
- Weekly scheduling.
- Effective-date ranges (term-wise or changed timetables).
- Timetable changes and teacher substitutions for specific dates.
- Elective-group lessons (several subjects running in parallel for one section).
- Conflict detection.

Acceptance criteria:
- M06-AC1: A section cannot have overlapping lessons (except parallel elective groups explicitly defined).
- M06-AC2: A teacher cannot teach two classes simultaneously.
- M06-AC3: A room cannot be allocated to two lessons simultaneously.
- M06-AC4: Timetable changes and substitutions are reflected in relevant dashboards and notify affected teachers.
- M06-AC5: Conflict checks are enforced in the database or inside a transaction, not only in the UI.

### M07 — Examination Management
**Phase:** 2 | **MVP:** Yes

Features:
- Examination creation.
- Examination categories (for example unit test, mid-term, final).
- Subject-wise examinations.
- Exam scheduling.
- Maximum and passing marks.
- Mark entry with statuses: present, absent, exempt, withheld.
- Grade configuration (grade scales).
- Term and multi-exam aggregation with configurable weightage.
- Pass/fail rules, ranks and remarks.
- Report cards (template-based PDF).
- Result publishing.
- Controlled correction of published results (reason, approval, revision history).
- Student performance reports.

Acceptance criteria:
- M07-AC1: Marks cannot exceed maximum marks.
- M07-AC2: Results can be published only by authorized users.
- M07-AC3: Published results can be changed only through a controlled correction that records old value, new value, reason, requester and approver.
- M07-AC4: Historical results remain available.
- M07-AC5: Report cards are generated only from published results and are reproducible (same inputs produce the same output).
- M07-AC6: Aggregation weightages for a term sum to 100% or the system blocks publication.

### M08 — Online Examination
**Phase:** 5 | **MVP:** No

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
- Result publishing (integrates with M07 results).

Acceptance criteria:
- M08-AC1: Students cannot access correct answers before authorized release.
- M08-AC2: Server-side examination timing is enforced.
- M08-AC3: Submitted attempts cannot be modified by students.
- M08-AC4: Descriptive questions support manual evaluation.
- M08-AC5: Interrupted attempts follow configurable recovery rules (resume window, time deduction policy, attempt limit).
- M08-AC6: Answer autosave tolerates brief network loss and never reverts to an older saved answer.

### M09 — Homework and Assignments
**Phase:** 2 | **MVP:** Yes (teacher creation; student and parent viewing; student submission is the only write action in the MVP student portal)

Features:
- Homework creation.
- Subject-wise assignments.
- Due dates.
- Attachments.
- Student submissions (late-submission policy configurable).
- Teacher feedback.
- Marks and evaluation.
- Parent visibility.

Acceptance criteria:
- M09-AC1: Students only see assignments relevant to their enrolment (class, section and elective subjects).
- M09-AC2: Submissions are timestamped by the server.
- M09-AC3: Teachers can evaluate only submissions for homework they are authorized to manage.

### M10 — Fee Management
**Phase:** 3 | **MVP:** Yes (offline payment modes only)

Features:
- Fee categories (fee types).
- Fee structures and templates.
- Student fee assignments (snapshot of the structure at assignment time).
- Installment schedules.
- Invoices.
- Discounts and concessions.
- Scholarships.
- Late fine rules (fixed, per-day, percentage; caps; grace days).
- Payment collection with payment modes: cash, cheque, bank transfer, UPI/QR (recorded manually), card (recorded manually), other configured modes.
- Cheque tracking (received, deposited, cleared, bounced) with bounce reversal.
- Partial payments.
- Multiple invoice allocations.
- Advance payments / credit balance (unallocated amount held as student credit).
- Receipts (PDF, unique numbering, duplicate copy marking).
- Refunds with approval workflow.
- Outstanding dues and carry-forward of dues across academic years.
- Fee reminders (via M15 notifications).
- Transport and hostel fee integration (M13, M14 generate fee assignments).

**Approval rules.** Refunds, discounts above a school-configured threshold, fine waivers and invoice cancellations require a second authorized user (maker-checker). The requester cannot approve their own request.

Acceptance criteria:
- M10-AC1: Fee templates can be changed without silently modifying existing student obligations.
- M10-AC2: Payment allocation cannot exceed payment amount or outstanding invoice balance.
- M10-AC3: Any unallocated remainder becomes recorded student credit and can be applied to later invoices.
- M10-AC4: Refunds cannot exceed refundable amounts and reference the original payment.
- M10-AC5: Receipts have unique school-level numbers generated without gaps caused by concurrency collisions.
- M10-AC6: Every financial correction is auditable and creates adjustment or reversal records.
- M10-AC7: Repeating a payment request with the same idempotency key does not create a second payment.
- M10-AC8: Outstanding dues from a prior year are visible in the new year and follow the school's promotion policy.
- M10-AC9: A bounced cheque reverses its allocations and restores invoice balances.

### M11 — Accounting
**Phase:** 3 (after M10; post-MVP) | **MVP:** No (financial event log is MVP so Accounting can be enabled later without back-filling)

Features:
- Chart of accounts.
- Income accounts.
- Expense accounts.
- Cash and bank accounts.
- Journal entries.
- Double-entry accounting.
- Automatic posting rules from M10 (invoice, payment, refund, concession, fine, bounced cheque), configurable per school.
- Manual journal entries.
- Ledger.
- Trial balance.
- Income statement.
- Balance sheet.
- Opening balances.
- Fiscal years and accounting periods with period close/lock.
- Financial reports.
- Reversal entries.

Acceptance criteria:
- M11-AC1: Every posted journal entry balances (debits equal credits), enforced in the database or transactionally.
- M11-AC2: Posted entries cannot be directly edited.
- M11-AC3: Corrections use reversal and replacement entries.
- M11-AC4: Financial reports reconcile with posted ledger entries.
- M11-AC5: Posting into a closed period is rejected unless the period is formally re-opened by an authorized user (audited).
- M11-AC6: Enabling Accounting for a school that already collected fees requires an opening-balance step and posts only forward from the chosen start date.
- M11-AC7: Each automatically posted entry links back to its source document (invoice, payment or refund).

### M12 — Library Management
**Phase:** 4 | **MVP:** No

Features:
- Book categories.
- Book catalogue.
- ISBN.
- Authors and publishers.
- Physical copies.
- Accession numbers.
- Library members (students and staff).
- Borrowing limits and loan periods (configurable per member type).
- Book issue and return.
- Due dates and renewals.
- Fines (calculated by rule; recorded as library fines; billable through M10 or settled at the counter as configured).
- Overdue reports.

Acceptance criteria:
- M12-AC1: A physical copy cannot have multiple active issues (database-enforced).
- M12-AC2: Book return updates copy availability.
- M12-AC3: Overdue fines follow school configuration.
- M12-AC4: Members cannot exceed borrowing limits.
- M12-AC5: Fine payment is recorded and auditable.

### M13 — Transportation Management
**Phase:** 4 | **MVP:** No

Features:
- Vehicle records and documents (insurance, fitness, permit expiry alerts).
- Vehicle capacity.
- Driver records (staff records with driver licence details and expiry).
- Vehicle-driver assignments with date ranges.
- Route creation.
- Route stops.
- Pickup and drop times.
- Student transport assignments with effective dates.
- Transport fees (generate fee assignments in M10).
- Transport attendance (boarding and drop-off).
- Vehicle maintenance.

Future enhancement:
- Live GPS tracking.

Acceptance criteria:
- M13-AC1: Students can only be assigned to valid routes and stops.
- M13-AC2: Vehicle capacity is enforced.
- M13-AC3: Driver access is limited to assigned transport records.
- M13-AC4: A route has at most one active primary driver per time window.
- M13-AC5: Expiring vehicle and licence documents generate admin notifications.

### M14 — Hostel Management
**Phase:** 4 | **MVP:** No

Features:
- Hostel buildings.
- Rooms.
- Beds.
- Wardens (staff with the Warden role).
- Student allocation.
- Vacating records.
- Occupancy reports.
- Hostel fee integration (generate fee assignments in M10).

Acceptance criteria:
- M14-AC1: A bed cannot have multiple active allocations (database-enforced).
- M14-AC2: Room capacity cannot be exceeded.
- M14-AC3: Historical allocations are retained.
- M14-AC4: A student cannot hold two active hostel allocations.

### M15 — Notifications and Messaging
**Phase:** 2 (in-app) and 4 (external channels, messaging) | **MVP:** In-app notifications only

Channels:
- In-app notifications (MVP).
- Email.
- SMS.
- Web push notifications (native mobile push is a future enhancement).
- Optional WhatsApp integration.

Features:
- Individual notifications.
- Class notifications.
- Parent notifications.
- Teacher communication.
- Message attachments.
- Read receipts.
- Notification templates (per event and language).
- User notification preferences (opt-in/opt-out per channel where policy allows).
- Delivery status and delivery-attempt records.
- Retry handling with backoff.
- Quotas and rate limits per school (to control SMS cost).

Acceptance criteria:
- M15-AC1: Notifications respect user authorization.
- M15-AC2: Failed external delivery does not destroy the in-app notification.
- M15-AC3: Each delivery attempt is recorded with status, provider response code and timestamp.
- M15-AC4: Bulk notifications are processed by background jobs and do not block the request.
- M15-AC5: Mandatory notices (for example fee dues, safety) can override opt-out only where the school policy marks them mandatory.

### M16 — Reports and Analytics
**Phase:** 2 (basic) through 5 (advanced) | **MVP:** Basic reports

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
- Export as background jobs with a download link for large datasets.

Acceptance criteria:
- M16-AC1: Report totals reconcile with source records (for example fee collection equals the sum of non-reversed payments for the period).
- M16-AC2: Exports respect the requester's permissions and are logged.
- M16-AC3: Exports larger than a configured row count run as background jobs.
- M16-AC4: Every report shows its filters, generation time and academic year.
- M16-AC5: Dashboard figures for a typical school load within the target in §10.

### M17 — Dynamic School Website
**Phase:** 5 | **MVP:** No

Features:
- Home page.
- About school.
- Principal's message.
- Academic information.
- Admission information.
- Faculty information (opt-in per staff member).
- Photo galleries.
- Announcements.
- Events.
- Contact page.
- SEO metadata and social-sharing previews.
- Navigation menu management.
- Page publishing (draft, scheduled, published).
- Rich-text content with server-side sanitization.
- Custom domain support (SaaS: automated certificate provisioning).

Acceptance criteria:
- M17-AC1: Schools can manage their own public website.
- M17-AC2: Draft pages are not publicly visible.
- M17-AC3: Published pages are accessible through school-specific URLs or configured domains.
- M17-AC4: Public pages never expose private school records.
- M17-AC5: Public pages are server-rendered with unique title, description and canonical metadata.
- M17-AC6: User-supplied rich text is sanitized and cannot execute scripts.

### M18 — Data Import, Export and Offboarding
**Phase:** 1 (students, staff, guardians import), 3 (fee data), 6 (full export and offboarding) | **MVP:** Import of students, guardians and staff; basic exports

Features:
- Template-based CSV/Excel import for students, guardians, staff, classes, subjects, fee structures and opening dues.
- Dry-run validation with row-level error report before commit.
- Import history with rollback of the most recent batch where no dependent records exist.
- Full school data export (structured files plus attachments) for standalone migration, school offboarding or backup.
- Student record package export (for transfers out).
- Data retention and anonymization tooling (see §9).

Acceptance criteria:
- M18-AC1: An import performs full validation before writing anything; invalid files commit nothing.
- M18-AC2: Imports are tenant-scoped and cannot reference another school's records.
- M18-AC3: Duplicate detection (for example admission number, email) is reported per row.
- M18-AC4: Full export of a school can be restored into a clean standalone installation (verified by test).
- M18-AC5: Import and export actions are audited.

### M19 — Configuration, Numbering and Integrations
**Phase:** 0–1 | **MVP:** Yes

Features:
- Numbering sequences for admission numbers, employee IDs, invoices, receipts, certificates and journal entries (prefix, year reset, padding, per-school).
- School settings (timezone, currency, locale, working days, grading defaults, late-fee defaults).
- Module enablement and plan limits.
- Per-school integration credentials (email, SMS, WhatsApp, push), encrypted.
- Document templates (receipt, report card, ID card, certificates).

Acceptance criteria:
- M19-AC1: Sequence numbers are unique per school and sequence type, even under concurrent requests.
- M19-AC2: Changing a numbering format affects only future documents.
- M19-AC3: Integration secrets are write-only through the API.

---

## 6. Database Architecture

### 6.1 Database Technology

PostgreSQL with Prisma ORM.

### 6.2 Database Design Principles

- UUID primary keys (time-ordered UUIDs such as UUIDv7 are preferred for index locality).
- Foreign-key constraints.
- Indexed search and filtering fields.
- `TIMESTAMPTZ` for timestamps; `DATE` for calendar dates interpreted in the school's timezone.
- `NUMERIC` for financial values, with a single scale per currency.
- JSONB for flexible structured content where justified.
- Soft deletion for appropriate business records.
- Immutable financial transaction history.
- Academic-year-specific enrolment records.
- School-level tenant isolation.
- Optimistic concurrency (`version` column) on records edited by several users, such as marks, timetable entries and invoices.
- Database-level constraints (unique, exclusion, check) for business rules that must hold under concurrency.

### 6.3 Main Database Tables

Tables marked † are new in v1.1.

#### Platform
- users
- schools
- school_memberships
- school_settings
- school_subscriptions
- subscription_plans
- plan_features †
- school_modules †
- platform_admins †
- support_access_grants †
- school_domains †
- school_integrations †
- document_sequences (implemented Phase 0 table for numbering_sequences †)

#### Authentication and Permissions
- roles
- permissions
- role_permissions
- user_roles
- sessions
- password_reset_tokens †
- user_mfa_methods / mfa_recovery_codes (implemented Phase 0 names for user_mfa †)
- user_invitations †
- login_attempts †
- idempotency_keys †

#### Academic
- academic_years
- academic_terms †
- calendar_events † (holidays, events, exam periods)
- classes
- sections
- subjects
- subject_groups † (elective groups)
- class_subjects
- teacher_assignments †
- class_teachers †
- students
- guardians †
- student_guardians
- student_enrollments
- student_subjects †
- student_documents
- student_medical_records †
- student_emergency_contacts †
- student_promotions
- student_transfers †
- certificates †
- document_templates †

#### Staff
- staff
- departments
- designations
- teacher_profiles
- staff_employment_history †
- staff_documents †

#### Attendance and Timetable
- attendance_sessions
- student_attendance
- staff_attendance
- leave_types †
- leave_balances †
- leave_requests
- timetable_periods
- classrooms
- timetables
- timetable_changes † (substitutions and date-specific changes)

#### Examination
- exam_categories †
- exams
- exam_subjects
- exam_schedules
- marks
- mark_revisions †
- grades (grade scales)
- exam_results
- result_aggregation_rules †
- report_cards †
- question_banks
- questions
- question_options
- online_exam_questions
- exam_attempts
- exam_answers

#### Homework
- homework
- homework_submissions

#### Financial
- fee_types
- fee_structures
- fee_structure_items
- fee_fine_rules †
- student_fee_assignments
- student_fee_assignment_items
- fee_installments
- invoices
- invoice_items
- payments
- payment_instruments † (cheque and instrument tracking)
- payment_allocations
- receipts †
- student_credits † (advance and unallocated amounts)
- payment_refunds
- refund_approvals †
- student_concessions (discounts and scholarships)
- financial_events † (append-only event log of every financial action)
- accounts
- fiscal_years †
- accounting_periods †
- posting_rules †
- journal_entries
- journal_entry_lines

#### Library
- book_categories
- authors †
- publishers †
- books
- book_copies
- library_members †
- book_issues
- library_fines †

#### Transportation
- vehicles
- vehicle_documents †
- drivers † (staff-linked driver details and licence)
- vehicle_drivers †
- transport_routes
- route_stops
- transport_assignments
- transport_attendance
- vehicle_maintenance

#### Hostel
- hostels
- hostel_rooms
- hostel_beds
- hostel_allocations

#### Communication
- notifications
- notification_recipients
- notification_deliveries † (one row per delivery attempt)
- notification_preferences †
- push_devices †
- notification_templates
- messages
- message_recipients
- message_attachments

#### System
- attachments (file metadata)
- audit_logs
- platform_audit_logs †
- system_settings
- jobs † (background and export jobs)
- import_batches †

#### Website
- website_settings
- website_pages
- website_menus
- website_announcements
- website_events †
- website_galleries
- website_media †

### 6.4 Tenant Isolation

Every school-owned record MUST be linked to its school.

Required safeguards:
1. School membership validation on every request.
2. Backend tenant-scoped database queries through a single data-access layer that injects the school filter (no raw un-scoped queries in module code).
3. Composite foreign keys for school ownership (child rows reference parent `(id, school_id)`).
4. PostgreSQL Row-Level Security on school-owned tables, using a school identifier set per transaction. Because Prisma uses pooled connections, the setting MUST be applied inside the same transaction as the queries (for example `SET LOCAL`), and the approach MUST be validated with pooling enabled before Phase 1 exit.
5. Automated cross-tenant isolation tests that run in CI from Phase 0 and grow with every module (not only in Phase 6/7).

The database MUST prevent a student from School A being linked to an enrolment, fee record or attendance record belonging to School B.

### 6.5 Academic History

Student identity and academic enrolment MUST remain separate.

A student can have different enrolments across academic years without overwriting previous class, section, attendance or examination history.

### 6.6 Financial Integrity

- Payment and allocation operations MUST be transactional.
- Posted journal entries MUST be balanced.
- Refunds MUST reference original payments.
- Financial records MUST NOT be physically deleted through normal application operations.
- Financial corrections MUST create traceable adjustment or reversal records.
- Every financial action appends to `financial_events`, which is the source for audit, reconciliation and later accounting back-fill.
- Receipt, invoice and journal numbers come from `numbering_sequences` using row-level locking or an equivalent concurrency-safe method.
- Money is stored as `NUMERIC` in the school currency's minor-unit precision; rounding rules (for example per-line or per-invoice) are defined in school settings and tested.

---

## 7. API Architecture

Base path: `/api/v1`

Use REST APIs with JSON requests and responses. Breaking changes require a new version (`/api/v2`); non-breaking additions do not.

### Main API Groups

| Group | Base route |
|---|---|
| Authentication | /auth |
| Current user / portals | /me |
| Platform (Super Admin) | /platform |
| Schools | /schools |
| Subscriptions and plans | /subscriptions, /plans |
| School settings and modules | /settings |
| Users | /users |
| Roles | /roles |
| Permissions | /permissions |
| Students | /students |
| Guardians | /guardians |
| Certificates | /certificates |
| Staff | /staff |
| Teachers | /teachers |
| Academics | /academic |
| Calendar | /calendar |
| Attendance | /attendance |
| Leave | /leave-requests |
| Timetable | /timetable |
| Examinations | /exams |
| Online exams | /online-exams |
| Homework | /homework |
| Fees | /fees |
| Invoices | /invoices |
| Payments and receipts | /payments, /receipts |
| Accounting | /accounting |
| Library | /library |
| Transport | /transport |
| Hostel | /hostel |
| Notifications | /notifications |
| Messages | /messages |
| Reports | /reports |
| Dashboards | /dashboards |
| Files and attachments | /files |
| Audit logs | /audit-logs |
| Imports and exports | /imports, /exports |
| Background jobs | /jobs |
| Integrations | /integrations |
| Website administration | /website |
| Public website (unauthenticated, read-only) | /public/{schoolSlug} |
| Health | /health |

### API Standards

- OpenAPI 3.1 documentation.
- Consistent error responses (machine-readable code, human message, request ID).
- Pagination (cursor or page-based; maximum page size enforced).
- Filtering.
- Sorting.
- Input validation.
- Rate limiting (stricter on authentication, public and export endpoints).
- Authentication middleware.
- Permission middleware.
- Tenant isolation middleware.
- Request logging with correlation IDs (no sensitive payloads logged).
- Idempotency keys for sensitive financial operations and bulk writes such as attendance.
- Optimistic-concurrency headers or version fields for editable records.

---

## 8. UI/UX Requirements

### 8.1 General Design

- Responsive Bootstrap 5 layout.
- Professional administrative dashboard.
- Sidebar navigation.
- Top navigation bar with school switcher for multi-school users.
- Breadcrumbs.
- Search and filters.
- Reusable tables.
- Modal forms where appropriate.
- Notification center.
- Profile and account menu.
- Responsive mobile navigation.
- Accessibility: keyboard navigation, visible focus, sufficient contrast, labelled controls (WCAG 2.1 AA target).
- Consistent loading, error and empty states.
- Confirmation and reason prompts for destructive or financial actions.

### 8.2 Dashboard Requirements

#### Super Administrator Dashboard
- Total schools.
- Active schools.
- Inactive schools.
- Subscription statistics.
- Platform usage.
- System health.
- Active support access grants.

#### School Administrator Dashboard
- Total students.
- Total staff.
- Today's attendance.
- Fee collection.
- Pending fees.
- Examination statistics.
- Recent activities.
- Upcoming events (from the school calendar).

#### Teacher Dashboard
- Assigned classes.
- Today's timetable and substitutions.
- Attendance tasks.
- Homework.
- Upcoming examinations.

#### Parent Dashboard
- Linked children.
- Attendance summaries.
- Homework.
- Examination results.
- Outstanding fees.
- Notifications.

#### Student Dashboard
- Timetable.
- Attendance.
- Homework.
- Examinations.
- Results.
- Notifications.

#### Accountant Dashboard
- Daily collections.
- Pending invoices.
- Outstanding dues.
- Refunds and pending approvals.
- Financial summaries.

#### Librarian Dashboard
- Total books.
- Available copies.
- Issued books.
- Overdue books.

#### Driver Dashboard
- Assigned vehicle.
- Route details.
- Stops.
- Assigned students.
- Transport tasks.

#### Hostel Warden Dashboard
- Occupancy.
- Available beds.
- Recent allocations and vacating.

---

## 9. Security and Privacy Requirements

### Authentication
- Secure password hashing using Argon2id or an equivalent approved password-hashing algorithm.
- Password policy (minimum length, breached-password check recommended).
- Account lockout or progressive delay after repeated failed logins; login attempts recorded.
- HTTP-only, Secure, SameSite cookies.
- CSRF protection.
- Session expiry, idle timeout and revocation (including "sign out everywhere").
- Password reset tokens: single-use, hashed at rest, short expiry.
- Multi-factor authentication: available to all users; **mandatory** for Super Administrator, platform administrators, School Administrators and Accountants (configurable per school for other roles).

### Authorization
- Role-based access control.
- Permission-level authorization.
- School membership validation.
- Record-level access checks.
- Parent-child relationship validation.
- Privilege-escalation guard: users cannot grant permissions they do not hold.

### Data Security
- HTTPS everywhere.
- Secure secrets management; no secrets in source control or images.
- Encryption at rest for databases, object storage and backups.
- Field-level encryption for especially sensitive data (medical records, integration credentials, any government identifiers).
- Government identity numbers (for example national ID numbers) MUST NOT be collected unless legally required; if collected they are encrypted and masked in the UI and exports.
- Database access restrictions.
- Private file storage with signed, short-lived download links.
- File upload controls: size limits, MIME and extension allow-list, content sniffing, malware scanning, filename sanitization.
- Input validation and output encoding.
- Protection against SQL injection, XSS, CSRF and SSRF.
- Rate limiting.
- Audit logging.

### Audit Logging
- Audit records are append-only, include actor, school, action, entity, before/after values (where applicable), IP address, user agent and timestamp.
- Audit records cannot be edited or deleted through the application.
- Minimum retention: 7 years or as required by local regulation, whichever is longer (configurable; confirm with legal counsel).
- Platform-level actions, including every use of a support access grant, are written to `platform_audit_logs` and are visible to the affected school.

### Sensitive Operations
The following operations MUST be audited:
- Fee refunds.
- Financial adjustments, reversals and period re-opening.
- Discounts, fine waivers and invoice cancellations.
- Examination result publication and corrections.
- Attendance corrections.
- Permission and role changes.
- Student record transfers, exports and certificate issue.
- User deactivation and MFA changes.
- Access to medical and emergency data.
- Data imports and exports.
- Super Administrator access to school data.

### Privacy and Data Protection
- Student data is children's personal data. The product MUST support lawful processing, purpose limitation and data minimization. The applicable regime (for example India's Digital Personal Data Protection Act, 2023 and its rules, including provisions on children's data and parental consent) MUST be reviewed by legal counsel before launch, including effective dates and the school/vendor roles (controller/processor).
- Schools can record consent and communication preferences for guardians.
- Retention policies are configurable per data category; retention defaults are set after legal review.
- Erasure and correction requests: personal data can be anonymized where retention is not legally required. Financial and audit records are retained but personal identifiers may be pseudonymized. Neither action may break financial integrity.
- Data export for the data subject (guardian or staff) is supported through M18 tooling.
- No behavioural tracking or advertising use of student data.

---

## 10. Non-Functional Requirements

### Capacity Assumptions (for sizing and load tests)

| Parameter | Planning assumption (confirm) |
|---|---|
| Schools on SaaS (year 1) | up to 200 |
| Students per school | typical 500–3,000; design ceiling 10,000 |
| Concurrent users per school at peak | up to 20% of active users |
| Attendance burst | all teachers submitting within the same 30-minute window |
| Fee collection peak | up to 5 collection counters per school |
| File storage per school | configurable by plan |

### Performance Targets

Initial engineering targets, subject to load testing against the capacity assumptions above:

- Normal API read requests: p95 under 500 ms.
- Normal API write requests: p95 under 800 ms.
- Dashboard initial data: under 2 seconds for typical datasets.
- Paginated tables rather than unbounded data retrieval.
- Background processing for large exports, PDF batches and bulk notifications.

### Scalability
- Stateless application servers where possible.
- Database connection pooling (compatible with the tenant-setting approach in §6.4).
- Indexed queries.
- Background job processing.
- Object storage for uploaded documents.
- Cache only where justified by measured performance.

### Reliability and Disaster Recovery
- Automated backups (encrypted) with documented retention.
- Restore testing at least quarterly in SaaS and before each major release.
- Recovery targets for hosted SaaS (initial): **RPO ≤ 15 minutes** (point-in-time recovery) and **RTO ≤ 4 hours** **(confirm)**. Standalone: documented default backup schedule and restore guide.
- Health checks.
- Error logging.
- Monitoring and alerting.
- Graceful job retries with dead-letter handling.
- Database migration tracking with tested rollback or forward-fix procedure.

### Availability
- Target 99.5% monthly availability for the hosted SaaS initial production service, excluding agreed maintenance windows. This is a target, not an existing guarantee.

### Localization
- Initial language: English; UI built i18n-ready (no hard-coded strings).
- Timezone default: Asia/Kolkata.
- Currency default: INR.
- Support for configurable school timezones and currencies, date formats and number formats.
- Regionally varying student identifiers and grading schemes are configurable fields, not hard-coded.

### Accessibility and Compatibility
- Target WCAG 2.1 AA for portal screens.
- Browser support matrix as stated in §3.1.

### Maintainability
- Linting, formatting and type checks enforced in CI.
- Minimum automated test coverage thresholds for services (financial and permission code is held to a higher bar) **(confirm)**.
- Dependency vulnerability scanning in CI.

---

## 11. Testing Strategy

### Unit Testing
- Business rules.
- Validation.
- Financial calculations (rounding, fines, allocations).
- Permission checks.
- Utility functions.

### Integration Testing
- API and database operations.
- Authentication and MFA.
- School membership and school switching.
- Payment transactions, idempotency and concurrency.
- Examination workflows.
- File uploads and malware-scan handling.
- Import dry-run and commit.
- Notification delivery and retries.

### Security Testing
- Cross-tenant access attempts (continuous from Phase 0).
- Unauthorized API access.
- Privilege escalation.
- File access control.
- Session security.
- Input validation.
- Dependency and container scanning.
- Support-access-grant controls.

### End-to-End Testing
- Student admission.
- Promotion.
- Attendance.
- Examination and report card.
- Fee collection, receipt and refund approval.
- Book issue and return.
- Transport assignment.
- Hostel allocation.
- Parent portal.
- Student portal.

### Performance Testing
- Concurrent user simulation against the capacity assumptions in §10.
- Large student datasets.
- Bulk attendance.
- Report generation and exports.
- Database query performance.

### Accessibility Testing
- Automated accessibility checks in CI plus manual keyboard and screen-reader review of key flows.

### Upgrade and Recovery Testing
- Upgrade from the previous release for a standalone installation, including data migration.
- Backup restore into a clean environment.
- Full school export restored into a standalone installation.

### User Acceptance Testing
- At least one pilot school validates the MVP workflow end to end with real data before production release.

---

## 12. Development Roadmap

The product MUST be developed in controlled phases. Do not attempt to implement all modules simultaneously. Cross-cutting capabilities that later phases depend on (audit logging, file storage, background jobs, numbering, tenant-isolation tests) are built in **Phase 0** and extended afterwards.

### Phase 0 — Foundation and Engineering Setup

Tasks:
- Repository initialization.
- Frontend and backend setup.
- TypeScript configuration.
- Docker environment.
- PostgreSQL setup.
- Prisma initialization.
- Authentication architecture (sessions, CSRF, password reset).
- Tenant isolation architecture (scoped data layer, composite keys, RLS proof-of-concept with connection pooling).
- Cross-tenant isolation test harness running in CI.
- Audit log foundation (writer service, append-only table).
- File storage abstraction, local storage adapter and file metadata.
- Background job queue and worker.
- Numbering sequence service (concurrency-safe).
- Feature-flag / module enablement framework.
- Idempotency-key middleware.
- Error handling.
- Logging.
- API documentation.
- CI checks.

Deliverable: Working application foundation with all cross-cutting services.

### Phase 1 — Platform and Core Administration

Tasks:
- School management and settings.
- User management and invitations.
- Authentication including MFA.
- Roles and permissions (including permission matrix seeding).
- Academic years, terms and school calendar.
- Classes, sections and subjects; elective groups.
- Student admission.
- Guardian management.
- Teacher and staff management; teacher and class-teacher assignments.
- Student and staff documents and photographs.
- Bulk import for students, guardians and staff (M18).
- Audit log viewer (basic).

Deliverable: Functional core School ERP.

### Phase 2 — Academic Operations

Tasks:
- Student attendance.
- Staff attendance.
- Leave management.
- Timetable, substitutions and conflict detection.
- Subject assignments and student-subject enrolment.
- Examinations, aggregation, results, report cards and result publishing.
- Homework and submissions.
- Student promotion, transfer and certificates.
- In-app notifications and attendance/homework/result notifications.
- Basic reports.

Deliverable: Complete academic management system.

### Phase 3 — Financial Management

**Phase 3A — Fee management (MVP):**
- Fee types.
- Fee structures.
- Student fee assignments.
- Installments.
- Invoices.
- Payments (offline modes), cheque tracking, receipts.
- Discounts and scholarships, late fines.
- Refunds with approval workflow.
- Credit balances and carry-forward of dues.
- Financial event log.
- Fee import (structures and opening dues).
- Basic fee reports.
- Parent and student read-only portals (MVP), including homework submission.

**Phase 3B — Accounting (post-MVP):**
- Chart of accounts, fiscal years, periods and opening balances.
- Posting rules and automatic journals from the financial event log.
- Ledger, trial balance, income statement, balance sheet.
- Period close and reversals.
- Financial reports.

Deliverable: Financially operational School ERP. **MVP is complete at the end of Phase 3A.**

### Phase 4 — Supporting School Modules

Tasks:
- Library.
- Transportation.
- Hostel.
- External notification channels (email, SMS, web push, optional WhatsApp), templates and preferences.
- Messaging and message attachments.
- Fee reminders.
- Audit log search and export.

Deliverable: Extended school administration system.

### Phase 5 — Portals and Advanced Features

Tasks:
- Full parent portal.
- Full student portal.
- Teacher portal.
- Accountant dashboard.
- Librarian dashboard.
- Driver dashboard.
- Warden dashboard.
- Online examinations.
- Dynamic school website (server-rendered public site).
- Advanced reports and exports.

Deliverable: Complete role-based ERP experience.

### Phase 6 — SaaS and Standalone Deployment

Tasks:
- SaaS onboarding wizard.
- Subscription plans and feature limits.
- Support access grants and platform audit.
- School isolation verification (full regression of the cross-tenant suite).
- Standalone installation package and installer.
- Offline licence validation.
- Cloud storage adapter (S3-compatible).
- Configuration management.
- Upgrade and migration process.
- Backup and restore.
- Full school export and offboarding.
- Deployment documentation.

Deliverable: Both deployment models operational.

### Phase 7 — Quality Assurance, Pilot and Production Release

Tasks:
- Full integration tests.
- Security tests and external security review.
- Cross-tenant tests.
- Performance tests.
- Data recovery tests.
- Accessibility review.
- Browser and mobile responsiveness.
- Pilot school user acceptance testing.
- Documentation.
- Legal and privacy review sign-off.
- Production deployment.

Deliverable: Production-ready release.

### Indicative Schedule

Planning assumption: a team of 3–4 experienced engineers plus part-time QA and design. This estimate replaces the 18–24 week figure in v1.0, which did not cover the cross-cutting services, additional modules and pilot phase now specified. It MUST be validated by engineering planning before commitment.

| Phase | Estimated duration |
|---|---:|
| 0 — Foundation | 3 weeks |
| 1 — Core administration | 4–5 weeks |
| 2 — Academic operations | 5–6 weeks |
| 3 — Financial management (3A and 3B) | 5–6 weeks |
| 4 — Supporting modules | 3–4 weeks |
| 5 — Portals and advanced features | 4–6 weeks |
| 6 — SaaS and standalone deployment | 3–4 weeks |
| 7 — QA, pilot and production release | 3–4 weeks |

**Indicative total: approximately 30–38 weeks. Indicative MVP (through Phase 3A): approximately 15–20 weeks.**

A solo developer should expect a materially longer schedule, particularly for accounting, online examinations, multi-tenant security and production deployment.

---

## 13. MVP Definition

The first usable release MUST NOT contain every advertised feature.

### MVP — Essential Features

| Capability | Delivered in |
|---|---|
| Authentication, MFA and password reset | Phase 0–1 |
| School management and settings | Phase 1 |
| User roles and permissions | Phase 1 |
| Academic years, terms, calendar | Phase 1 |
| Student admission and guardian management | Phase 1 |
| Teacher management and assignments | Phase 1 |
| Classes, sections, subjects, electives | Phase 1 |
| Bulk import (students, guardians, staff) | Phase 1 |
| Student attendance and staff attendance | Phase 2 |
| Leave requests | Phase 2 |
| Timetable | Phase 2 |
| Examination, results and report cards | Phase 2 |
| Basic homework (create, view, submit) | Phase 2 |
| Promotion, transfer and Transfer Certificate | Phase 2 |
| In-app notifications | Phase 2 |
| Fee structures, assignments, invoices | Phase 3A |
| Payment collection (offline modes) and receipts | Phase 3A |
| Refund approval, discounts, fines | Phase 3A |
| Basic reports | Phase 2–3A |
| Parent and student portals (read-only, except homework submission) | Phase 3A |
| Audit logging of sensitive actions | Phase 0 (foundation), applied continuously |
| Local storage adapter | Phase 0 |

### Not in the MVP
Accounting (Phase 3B), library, transport, hostel, messaging, external notification channels, online examinations, public website, SaaS subscription billing, cloud storage adapter and offboarding tooling.

The first MVP should prove that the complete school administration workflow works correctly with a pilot school before expanding into advanced features.

---

## 14. Future Enhancements

Possible future additions:

- Native mobile applications and native push notifications.
- Live GPS tracking.
- Biometric attendance integration.
- RFID student identification.
- Online payment gateway integration.
- UPI payment reconciliation.
- Advanced analytics.
- AI-assisted reporting.
- Automated parent communication workflows.
- Online admission applications.
- Digital certificates with QR verification (basic Transfer Certificate and bonafide certificates are in scope, see M02).
- Library barcode scanning and reservations.
- Additional interface languages.
- Advanced examination proctoring.
- Dedicated-database-per-school enterprise SaaS option.

These are not required for the initial release.

---

## 15. Definition of Done

A module is not considered complete merely because its interface exists.

Every module MUST have:

1. Database schema and migrations (with tested upgrade path).
2. Backend APIs.
3. Validation rules.
4. Authorization checks.
5. Tenant isolation (including cross-tenant tests).
6. Frontend screens.
7. Loading, error and empty states.
8. Unit tests.
9. Integration tests.
10. Audit handling where necessary.
11. API documentation.
12. Acceptance tests covering every `Mxx-ACn` criterion.
13. Accessibility check of its screens.
14. Performance check of its heaviest list/report query against the §10 capacity assumptions.
15. i18n-ready strings (no hard-coded user-facing text).

---

## 16. Final Technical Decisions

| Area | Decision | Status |
|---|---|---|
| Frontend | React + Vite + TypeScript | Decided |
| Backend | Node.js + Express + TypeScript | Decided |
| UI | Bootstrap 5 | Decided |
| HTTP client | Standardized Fetch wrapper | Decided |
| Charts | Recharts | Decided (D1) |
| Database | PostgreSQL | Decided |
| ORM | Prisma | Decided |
| API | REST / JSON | Decided |
| API documentation | OpenAPI 3.1 | Decided |
| Authentication | Secure server-managed sessions | Decided |
| Authorization | RBAC + record-level permissions | Decided |
| Architecture | Modular monolith | Decided |
| SaaS tenancy | Shared multi-tenant database (dedicated DB deferred) | Decided |
| Standalone | Independent deployment and database | Decided |
| File storage | Local + S3-compatible object storage behind one adapter | Decided |
| Containerization | Docker | Decided |
| Background jobs | BullMQ + Redis 7 (SaaS and Standalone) | Decided (D2) |
| PDF / Exports | `pdfkit` (PDF) + `exceljs` (Excel/CSV) | Decided (D3) |
| Public website rendering | Backend server-side rendering (Phase 5) | Decided (D4) |
| Testing | Unit + integration + E2E + security + accessibility + UAT | Decided |
| Documentation | Markdown | Decided |

---

## 17. Final Product Acceptance Criteria

The School ERP can be considered ready for its initial production release when:

- All eight roles (and the Warden template) can authenticate and access authorized dashboards.
- MFA is enforced for mandatory roles.
- School Administrators have complete authority within their school.
- Super Administrators can manage the SaaS platform and cannot read school records without an audited support access grant.
- Multiple schools can operate without cross-tenant data exposure, proven by the full cross-tenant test suite.
- Standalone installations work independently, including offline licence validation.
- Local and cloud document storage both work.
- Student admission, academic promotion, transfer and Transfer Certificate issue work.
- Attendance and examination workflows work, including controlled correction.
- Fee collection, refunds and (where enabled) accounting remain financially consistent and reconcile with reports.
- Parent and student portals enforce ownership restrictions.
- Audit logs record all sensitive actions listed in §9.
- Backups can be restored successfully, and a full school export can be restored into a clean standalone installation.
- Bulk import works with dry-run validation.
- Accessibility, performance and security targets are met in testing.
- At least one pilot school has completed user acceptance testing.
- Legal and privacy review is signed off.
- Critical security and integration tests pass.
- Installation and deployment documentation is complete.

---

## 18. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Scope is large for the team size | Schedule slip | Hold the MVP boundary (§13); phase gates; descope Phase 5 items first |
| Tenant isolation defect | Severe data exposure | Scoped data layer + composite keys + RLS + CI cross-tenant suite from Phase 0 |
| RLS behaves incorrectly with pooled connections | Isolation failure or bugs | Proof-of-concept in Phase 0 with `SET LOCAL` inside transactions |
| Financial inconsistency | Loss of trust | Append-only financial events, transactional allocation, idempotency, reconciliation tests |
| Regulatory change on children's data | Rework | Early legal review; consent and retention features are configurable |
| SMS/WhatsApp cost and regulatory registration delays | Delayed notifications | In-app first; per-school quotas; start provider registration in Phase 2 |
| Standalone customers lack IT support | Support burden | One-command Docker install, documented backup/restore, tested upgrades |
| Data migration from existing school systems | Slow onboarding | Import tooling with dry run (M18); pilot-led template refinement |
| Report and PDF generation load | Slow requests | Background jobs, pagination, caching only after measurement |

---

## 19. Decisions Log (Closed for Phase 1+)

| # | Decision | Closed Resolution | Owner |
|---|---|---|---|
| D1 | Chart library | Recharts | Frontend lead |
| D2 | Job queue technology | BullMQ + Redis 7 (aligned with Phase 0 stack) | Backend lead |
| D3 | PDF / export generation approach | `pdfkit` (PDF) + `exceljs` (Excel/CSV) for MVP | Backend lead |
| D4 | Public website rendering | Backend server-side rendering (Phase 5) | Architecture |
| D5 | SMS provider and regulatory registration plan | Adapter interface; choose provider at Phase 2 start | Product |
| D6 | RPO/RTO targets | RPO 15 min, RTO 4 h (SaaS) | Operations |
| D7 | Capacity assumptions | As in §10 | Product + Architecture |
| D8 | Audit and data retention periods | 7 years audit; legal review before pilot launch | Legal |
| D9 | Maker-checker thresholds for discounts and refunds | Configurable per school; default: all refunds require approval | Product |
| D10 | Rounding policy (per line vs per invoice) | Per line, half-up, configurable in `school_settings` | Finance SME |
| D11 | Whether students can view fee information by default | Off by default; per-school toggle in `school_settings` | Product |
| D12 | Licensing model for standalone | Signed offline licence file (Phase 6) | Business |

---

## Conclusion

This PRD establishes the functional and technical baseline for building a complete School Management System.

The system will use one modular codebase that supports both multi-school SaaS and standalone school deployments. Its foundation will prioritize data isolation, academic history, financial integrity, role-based permissions and maintainability.

**Implementation should begin with Phase 0 and Phase 1, after the open decisions in §19 are closed.** Do not build every module at once, and do not treat a visually complete interface as evidence that a business workflow is complete.

---

## Appendix A — Glossary

| Term | Meaning |
|---|---|
| Tenant | A school within the multi-school SaaS deployment |
| Active school context | The single school a session is currently operating in |
| Enrolment | A student's placement in a class and section for one academic year |
| Maker-checker | Rule that the person requesting a sensitive action cannot also approve it |
| Idempotency key | Client-supplied key that makes repeated requests safe |
| RLS | PostgreSQL Row-Level Security |
| RPO / RTO | Maximum acceptable data loss / maximum acceptable recovery time |
| Support access grant | Time-limited, audited permission for platform staff to view a school's data |
| Financial event log | Append-only record of every financial action, used for audit and accounting back-fill |
| Installation Owner | First administrator of a standalone installation |

---

## Appendix B — Change Log (v1.0 to v1.1)

| # | v1.0 finding | Resolution in v1.1 |
|---|---|---|
| 1 | §1.3 said "following major modules" but listed roles | Roles and modules now listed separately (§1.3) |
| 2 | Module 16 had no acceptance criteria | Added M16-AC1–AC5 |
| 3 | Deployment table vs text conflict on dedicated DB | Dedicated DB deferred; table and text aligned (§2.1) |
| 4 | MVP did not match roadmap (portals in Phase 5) | MVP mapped to phases; portals in Phase 3A (§12, §13) |
| 5 | Audit, storage, jobs scheduled after features needing them | Moved to Phase 0 (§12) |
| 6 | SEO required but SPA chosen | Server-rendered public site (§3.1, M17-AC5) |
| 7 | Notifications/push vs future items; none in MVP | In-app in MVP; external in Phase 4; native push future (M15) |
| 8 | MVP "read-only" vs student submissions | Homework submission defined as the single write action (M09) |
| 9 | "Student transfer" ambiguous | Three transfer types defined (M02) |
| 10 | Heading levels inconsistent | Normalized (H1 title, H2 sections, H3 subsections) |
| 11 | "Final" decisions left open (client, charts, queue) | Decided or listed in §16 and §19 |
| 12 | Missing tables (guardians, assignments, electives, terms, calendar, receipts, fine rules, deliveries, etc.) | Added in §6.3 (marked †) |
| 13 | Missing fee rules (payment modes, overpayment, carry-forward, refund approval) | Added to M10 |
| 14 | Missing accounting integration (posting, periods, opening balances) | Added to M11 and financial event log |
| 15 | Exam aggregation, absent/exempt statuses, grade rules | Added to M07 |
| 16 | No bulk import / offboarding | New M18 |
| 17 | No certificates | Transfer Certificate and bonafide added to M02 |
| 18 | No Warden role; no permission matrix | Warden template (§4.8) and matrix (§4.10) |
| 19 | Multi-school session behaviour undefined | §2.3 |
| 20 | Standalone platform role and licensing undefined | §2.4 |
| 21 | "Configurable modules" not specified | §2.5, M01, M19, feature-flag tables |
| 22 | Platform admins and Super Admin access auditing unspecified | §4.1, support_access_grants, platform audit log |
| 23 | Security gaps (lockout, mandatory MFA, upload scanning, encryption, retention, privacy) | Expanded §9 |
| 24 | RLS with Prisma not addressed | §6.4 and Phase 0 proof-of-concept |
| 25 | No RPO/RTO, capacity, browser, accessibility targets | Added to §3.1 and §10 |
| 26 | API missing route groups | Added in §7 |
| 27 | Testing missing upgrade, accessibility, UAT | Added to §11 |
| 28 | Schedule optimistic | Revised to 30–38 weeks, MVP 15–20 weeks, to be validated (§12) |
| 29 | No requirement IDs, metrics, assumptions, risks, glossary, change log | Added IDs, §1.4–1.6, §18, Appendices A–B |
| 30 | Status "Finalized" despite open items | Status changed to Draft with §19 open decisions |
