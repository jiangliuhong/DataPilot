<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Overview

This project uses Next.js App Router with a strict frontend/backend separation architecture.

Frontend and backend must communicate through HTTP APIs only.

All backend endpoints are implemented under `app/api`.

The frontend must never access the database directly.

---

# Core Architecture Principles

1. Frontend and backend are strictly separated.
2. All APIs must be located under `app/api`.
3. Frontend communicates with backend through `api-client`.
4. Database access is allowed only inside repositories.
5. Business logic is allowed only inside services.
6. Route handlers must remain thin.
7. HeroUI is the primary UI framework.
8. Drizzle ORM is the only ORM.
9. Feature-based organization is preferred.
10. Avoid large files and oversized components.

---

# Directory Structure

```text
src/
├── app/                          # Backend (server-side)
│   ├── api/                      # API route handlers
│   ├── auth/
│   ├── users/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── db/                       # Database layer
│   │   ├── index.ts
│   │   ├── schema/
│   │   ├── relations/
│   │   └── migrations/
│   └── server/                   # Business logic layer
│       ├── services/
│       ├── repositories/
│       ├── schemas/
│       ├── middleware/
│       ├── errors/
│       └── types/
│
├── web/                          # Frontend (client-side)
│   ├── api-client/               # API abstraction layer
│   │   ├── request.ts
│   │   ├── auth.ts
│   │   ├── user.ts
│   │   └── ...
│   ├── features/                 # Feature modules
│   │   ├── auth/
│   │   ├── user/
│   │   ├── order/
│   │   └── ...
│   ├── components/               # UI components
│   │   ├── ui/
│   │   ├── layout/
│   │   └── shared/
│   ├── hooks/
│   ├── lib/
│   ├── constants/
│   ├── types/
│   └── utils/
```

---

# Layer Responsibilities

## app/

Responsible only for routing.

Allowed:

* page.tsx
* layout.tsx
* loading.tsx
* error.tsx
* route.ts

Forbidden:

* Drizzle queries
* business logic
* authorization logic
* validation logic
* complex transformations

---

## app/api

Acts as transport layer only.

Responsibilities:

* receive request
* parse request
* validate request
* call service
* return response

Must remain thin.

Must not contain:

* database access
* Drizzle queries
* business logic

---

## api-client

Frontend API abstraction layer.

Frontend code must call api-client methods.

Do not call fetch directly inside pages.

Preferred:

```ts
await userApi.list();
```

Avoid:

```ts
await fetch("/api/users");
```

---

## services

Contains business logic.

Examples:

* authentication
* permissions
* workflows
* orchestration
* transactions

Services may call:

* repositories
* external APIs
* other services

Services must never contain UI code.

---

## repositories

Single source of truth for database access.

Responsibilities:

* queries
* inserts
* updates
* deletes

Repositories must not contain:

* permissions
* workflows
* business rules

---

# Repository First Rule

Repository is the single source of truth for database access.

Before creating a query:

1. Search existing repositories.
2. Reuse repository methods if possible.
3. Extend repositories before creating new ones.
4. Create repository methods before service methods.
5. Never write database queries in services.
6. Never write database queries in routes.
7. Never duplicate query logic.

Required flow:

```text
UI
 ↓
API Client
 ↓
Route
 ↓
Service
 ↓
Repository
 ↓
Drizzle
 ↓
Database
```

Forbidden:

```text
Page → Drizzle
Component → Drizzle
Route → Drizzle
Service → Drizzle
```

---

# Repository Ownership Rule

Repositories represent domains.

Allowed:

```text
user.repository.ts
order.repository.ts
product.repository.ts
```

Avoid:

```text
login.repository.ts
register.repository.ts
dashboard.repository.ts
admin.repository.ts
```

Repository naming should follow entities, not actions.

---

# Drizzle ORM Rules

This project uses Drizzle ORM exclusively.

Never generate:

* Prisma
* TypeORM
* Sequelize
* MikroORM

---

## Database Initialization

Location:

```text
src/app/db/index.ts
```

Only one shared database instance.

Example:

```ts
export const db = drizzle(client);
```

Do not create additional instances.

---

## Schema Rules

Location:

```text
src/app/db/schema/
```

One file per domain.

Preferred:

```text
schema/
├── user.ts
├── order.ts
├── product.ts
```

Avoid:

```text
schema.ts
```

containing the entire database.

---

## Relation Rules

Location:

```text
src/app/db/relations/
```

Keep relations separated from table definitions.

---

## Migration Rules

All schema changes require migrations.

Required workflow:

```bash
drizzle-kit generate
drizzle-kit migrate
```

Never manually edit generated migrations.

---

## Transaction Rules

Transactions belong in services.

Example:

```ts
await db.transaction(async (tx) => {
  ...
});
```

Do not place transaction logic inside route handlers.

---

# Validation Rules

Use Zod.

Location:

```text
src/app/server/schemas/
```

Validation must be reusable.

Used by:

* API routes
* forms
* services

Avoid duplicated validation logic.

---

# HeroUI Rules

HeroUI is the default UI framework.

Use HeroUI whenever possible.

Preferred components:

* Button
* Input
* Select
* Modal
* Card
* Table
* Tabs
* Dropdown
* Form
* Navbar

Avoid custom implementations when HeroUI already provides the component.

---

# Component Rules

Preferred:

* less than 150 lines

Warning:

* over 200 lines

Must refactor:

* over 300 lines

Split into:

* components
* hooks
* utility functions

---

# Page Rules

Preferred:

* under 100 lines

Maximum:

* 200 lines

Pages should compose components.

Pages should not contain business logic.

---

# Route Rules

Preferred:

* under 50 lines

Maximum:

* 100 lines

Routes should:

* validate
* call service
* return response

Nothing more.

---

# Service Rules

Preferred:

* under 200 lines

Maximum:

* 300 lines

Split large services.

Example:

```text
user-create.service.ts
user-update.service.ts
user-auth.service.ts
```

---

# Repository Rules

Preferred:

* under 200 lines

Maximum:

* 300 lines

Repositories should focus on one domain.

---

# State Management Rules

Default:

* React State
* React Context

Use Zustand only when necessary.

Do not introduce Redux unless explicitly required.

---

# Import Rules

Always use aliases.

Preferred:

```ts
@/app/server/services
@/app/server/repositories
@/app/db/schema
@/web/components
```

Avoid:

```ts
../../../../components
```

---

# Naming Rules

Tables:

```ts
users
orders
products
```

Columns:

```ts
userId
createdAt
updatedAt
deletedAt
```

Repositories:

```ts
user.repository.ts
order.repository.ts
```

Services:

```ts
user.service.ts
order.service.ts
```

Schemas:

```ts
user.schema.ts
order.schema.ts
```

---

# Pagination Rules

List APIs must support pagination.

Preferred:

```ts
limit
offset
```

or

```ts
cursor
```

Never return unbounded datasets.

---

# Soft Delete Rules

Prefer soft delete.

Standard field:

```ts
deletedAt
```

Repository queries should exclude soft-deleted records by default.

---

# AI Code Generation Rules

When generating code:

1. Follow the existing architecture.
2. Reuse repositories first.
3. Reuse services first.
4. Use HeroUI for UI.
5. Use Drizzle ORM only.
6. Keep routes thin.
7. Keep business logic in services.
8. Keep queries in repositories.
9. Avoid large files.
10. Generate maintainable code over clever code.
11. Prefer composition over inheritance.
12. Prefer explicit code over abstraction.
13. Do not create duplicate functionality.
14. Always check existing modules before creating new ones.
15. Maintain consistent naming conventions.

```
```

# NON-NEGOTIABLE RULES

1. Never access Drizzle outside repositories.
2. Never place business logic in route handlers.
3. Frontend must call APIs through api-client.
4. Use HeroUI whenever possible.
5. Reuse existing repositories and services before creating new ones.