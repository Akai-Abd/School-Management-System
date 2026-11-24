# School Management System (School ERP)

[![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=github-actions&logoColor=white)](.github/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](tsconfig.base.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A **multi-tenant SaaS & standalone School ERP** built as a TypeScript modular monolith on **PostgreSQL + Prisma**, **Express**, and **React + Vite + Bootstrap 5**.

> **Current Status:** Phase 0 (Foundation & Security Core) complete. Full product specification lives in [School Management System.md](School%20Management%20System.md).

---

## Architecture Highlights

- **Dual Deployment (`APP_MODE=saas|standalone`):** Single codebase supporting multi-school cloud SaaS or self-hosted single-school installations.
- **Tenant Isolation:** Composite foreign keys `(school_id, entity_id)` paired with a mandatory `forTenant(schoolId)` Prisma client extension (with PostgreSQL RLS scheduled for Phase 6 hardening).
- **Session & CSRF Security:** `Argon2id` password hashing, HTTP-only `SameSite=Lax` PostgreSQL-backed sessions, per-session `X-CSRF-Token` validation, `Origin` checks, and `active_school_id` switching.
- **Interchangeable File Storage:** `StorageAdapter` supporting local disk (`LOCAL_STORAGE_DIR`) and S3-compatible object storage with magic-byte MIME validation (PNG, JPEG, WebP, PDF; SVG/HTML blocked).
- **API Contracts & Docs:** Shared Zod schemas (`@school-erp/contracts`) and auto-generated **OpenAPI 3.1** docs at `/docs` and `/openapi.json`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, TypeScript, Bootstrap 5, React Router, TanStack Query, React Hook Form, Zod |
| Backend | Node.js 22+, Express, TypeScript, Prisma ORM, Zod, Argon2, Pino, BullMQ |
| Database & Queue | PostgreSQL 16, Redis 7 |
| Storage | Local filesystem or S3-compatible object storage |
| Testing | Vitest, Supertest |

---

## Repository Structure

```text
├── apps/
│   ├── api/                 # Express modular monolith, Prisma schema & migrations
│   └── web/                 # React + Vite + Bootstrap 5 SPA
├── packages/
│   └── contracts/           # Shared Zod schemas, DTOs, and permission constants
├── docker/
│   └── docker-compose.yml   # PostgreSQL 16 + Redis 7 services
├── .github/workflows/       # CI pipeline (typecheck, build, test)
├── School Management System.md
└── LICENSE
```

---

## Quick Start

### Prerequisites
- Node.js `>= 22` & `pnpm` `9+`
- Docker & Docker Compose

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env

# 3. Start PostgreSQL & Redis
docker compose -f docker/docker-compose.yml up -d

# 4. Generate Prisma client, run migrations, and bootstrap standalone school/admin
pnpm db:generate
pnpm db:migrate
pnpm db:bootstrap

# 5. Start API (port 4000) and Web (port 5173)
pnpm dev
```

### Verification Commands

```bash
pnpm typecheck
pnpm build
pnpm test
```

---

## Roadmap

- **Phase 0 (Done):** Monorepo, Docker stack, Prisma foundation schema, Argon2id session + CSRF auth, `forTenant` isolation, Local/S3 storage adapters, OpenAPI 3.1, web shell, CI.
- **Phase 1:** Schools, RBAC permissions UI, academic years, staff/teachers, students & guardians.
- **Phase 2:** Attendance, leave management, timetable conflict control, examinations, homework, promotions.
- **Phase 3A & 5A (MVP):** Fee structures, invoices, payments, receipts (`pdfkit`), refunds, read-only parent/student portals, basic exports (`exceljs`/`pdfkit`).
- **Phase 3B–7:** Double-entry accounting, library, transport, hostel, notifications, online exams, dynamic school website, PostgreSQL RLS, and production hardening.

---

## License

Licensed under the [MIT License](LICENSE).
