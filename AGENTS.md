<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Architecture

This project uses Next.js App Router with a strict frontend/backend separation model.

### Core Principles

1. All backend APIs must be implemented under `app/api`.
2. Frontend code must never access the database directly.
3. Frontend code must never import repositories or services.
4. Frontend communicates only through HTTP requests.
5. Server Actions are prohibited unless explicitly requested.
6. Database access must only occur in repositories.
7. Business logic must only exist in services.
8. UI components must use HeroUI.
9. Prefer feature-based organization over technical-layer organization.
10. Avoid large files and large components.

---

# Directory Structure

```text
src/
├── app/
│   ├── api/
│   ├── dashboard/
│   ├── users/
│   └── layout.tsx
│
├── features/
│   ├── auth/
│   ├── user/
│   ├── order/
│   └── ...
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── shared/
│
├── api-client/
│
├── server/
│   ├── services/
│   ├── repositories/
│   ├── schemas/
│   ├── middleware/
│   └── types/
│
├── hooks/
├── lib/
├── constants/
└── types/
```

---

# Layer Responsibilities

## app/

Only routing concerns belong here.

Allowed:

* page.tsx
* layout.tsx
* loading.tsx
* error.tsx
* route.ts

Forbidden:

* database queries
* business logic
* Prisma calls
* validation logic
* complex data transformation

---

## app/api

Acts as transport layer only.

Responsibilities:

* receive request
* validate request
* call service
* return response

Must not contain:

* Prisma
* SQL
* business rules
* complex calculations

Example:

```ts
export async function GET() {
  const users = await userService.findAll();

  return Response.json(users);
}
```

---

## server/services

Contains business logic.

Responsibilities:

* authorization
* workflows
* business rules
* orchestration

Services may call:

* repositories
* external APIs
* other services

Services must not:

* render UI
* contain React code

---

## server/repositories

Contains all database access.

Responsibilities:

* Prisma
* SQL
* data persistence

Repositories must not:

* contain business rules
* contain authorization logic

---

## api-client

Frontend API abstraction layer.

Frontend pages and components must call api-client functions.

Do not use fetch directly inside pages or components unless necessary.

Example:

```ts
const users = await userApi.list();
```

Instead of:

```ts
await fetch("/api/users");
```

---

# Feature Organization

Each business domain should have its own feature folder.

Example:

```text
features/
└── user/
    ├── components/
    ├── hooks/
    ├── types.ts
    └── constants.ts
```

Feature code should remain close together.

Avoid creating global folders prematurely.

---

# HeroUI Rules

HeroUI is the primary UI framework.

Use HeroUI components whenever available.

Preferred:

* Button
* Input
* Select
* Modal
* Card
* Table
* Tabs
* Dropdown

Avoid custom implementations when HeroUI already provides the component.

Only build custom components when:

* HeroUI does not provide it
* project-specific behavior is required

Maintain consistent HeroUI styling across the application.

---

# Component Rules

## Component Size

Preferred:

* < 150 lines

Warning:

* > 200 lines

Must Refactor:

* > 300 lines

Split into:

* presentational components
* hooks
* utility functions

---

## Page Size

Preferred:

* < 100 lines

Maximum:

* 200 lines

Pages should compose components.

Pages should not contain large amounts of business logic.

---

# Service Size

Preferred:

* < 200 lines

Maximum:

* 300 lines

Large services must be split into multiple services.

Example:

```text
user.service.ts
user-create.service.ts
user-update.service.ts
user-auth.service.ts
```

---

# Repository Size

Preferred:

* < 200 lines

Maximum:

* 300 lines

Repositories should focus on a single aggregate/domain.

---

# API Route Size

Preferred:

* < 50 lines

Maximum:

* 100 lines

Route handlers should remain thin.

---

# Validation

Use Zod for all validation.

Validation schemas belong in:

```text
server/schemas/
```

Never duplicate validation logic.

Reuse schemas across:

* API routes
* forms
* services

---

# State Management

Default:

* React State
* React Context

Use Zustand only when shared state becomes complex.

Do not introduce Redux unless explicitly required.

---

# Data Fetching

Client Components:

```ts
api-client/*
```

Server Components:

```ts
api-client/*
```

Always consume APIs through the api-client layer.

Do not access repositories or services directly from UI.

---

# Imports

Preferred:

```ts
@/features/user
@/components/ui
@/server/services
```

Avoid deep relative imports.

Bad:

```ts
../../../../../components
```

Good:

```ts
@/components
```

---

# Database Access Rule

Allowed:

```text
Repository
  ↓
Prisma
```

Forbidden:

```text
Page → Prisma
Component → Prisma
Service → Prisma
API Route → Prisma
```

Only repositories may access Prisma.

---

# Code Generation Rules

When generating code:

1. Follow existing project structure.
2. Reuse existing services before creating new ones.
3. Reuse existing repositories before creating new ones.
4. Use HeroUI for UI.
5. Prefer composition over large files.
6. Do not create files exceeding size limits.
7. Keep route handlers thin.
8. Keep pages focused on rendering.
9. Keep business logic inside services.
10. Keep database logic inside repositories.

```
```
