## ADDED Requirements

### Requirement: Task entity and ownership

The system SHALL persist a **task** entity that represents a reusable, named dbt command definition. A task SHALL belong to exactly one `dbt_project` (via `projectId`) and SHALL bind to exactly one runtime environment (via `environmentId`) that is itself bound to the same project through `dbt_project_environments`. Each task SHALL store a dbt `command` (one of `run | build | test | compile | seed | snapshot`), optional selector parameters (`select`, `exclude`), a `fullRefresh` boolean, an optional `vars` JSON string, an optional `target`, an optional `description`, and reserved scheduling fields (`scheduleCron`, `scheduleStatus`) that SHALL be nullable / defaulted in the first phase. Tasks SHALL follow the project-wide soft-delete convention (`deletedAt`); all default queries SHALL exclude soft-deleted tasks.

#### Scenario: Task belongs to a project and a project-bound environment

- **WHEN** a task is created with `projectId=P` and `environmentId=E`
- **AND** `E` is bound to `P` through `dbt_project_environments` (not soft-deleted)
- **THEN** the system SHALL persist the task with `projectId=P` and `environmentId=E`

#### Scenario: Environment must be bound to the same project

- **WHEN** a task is created with `projectId=P` and `environmentId=E`
- **AND** `E` is NOT bound to `P` through `dbt_project_environments`
- **THEN** the system SHALL reject creation with a validation error and SHALL NOT persist the task

#### Scenario: Soft-deleted tasks are excluded by default

- **WHEN** any default list / get / run operation queries tasks
- **THEN** tasks whose `deletedAt` is not null SHALL be excluded
- **AND** explicitly addressing a soft-deleted task by id (e.g. run, update) SHALL return a not-found error

### Requirement: Task name uniqueness within a project

The system SHALL enforce that the combination `(projectId, name)` is unique among non-soft-deleted tasks. Two tasks in different projects MAY share the same name.

#### Scenario: Duplicate name in same project rejected

- **WHEN** a task is created or renamed to a `name` that already exists for a non-soft-deleted task under the same `projectId`
- **THEN** the system SHALL reject the operation with a conflict error

#### Scenario: Same name allowed across projects

- **WHEN** a task is created with a `name` that exists under a different `projectId`
- **THEN** the system SHALL accept the creation

### Requirement: Task command parameter set

The `command` field SHALL be one of `run | build | test | compile | seed | snapshot`. The system SHALL persist the full command enum at the data layer and SHALL validate it through Zod. The frontend first-phase task form SHALL only allow the user to choose `run`, but the backend SHALL NOT restrict creation to `run` only — this keeps the data model forward-compatible without a breaking change.

#### Scenario: Backend accepts any command in the supported enum

- **WHEN** a task is created via the API with `command` set to any of `run | build | test | compile | seed | snapshot`
- **THEN** the system SHALL persist the task with that command value

#### Scenario: Unknown command rejected

- **WHEN** a task is created with `command` outside the supported enum
- **THEN** the system SHALL reject creation with a validation error

#### Scenario: Frontend task form only exposes run

- **WHEN** a user creates or edits a task through the task scheduling page form
- **THEN** the command selector SHALL offer only `run` (locked) and SHALL submit `command: "run"` in the request body

### Requirement: Task vars must be valid JSON

When `vars` is provided, the system SHALL validate that it is a syntactically valid JSON string (representing a JSON object). The system SHALL NOT perform template rendering or variable interpolation on `vars` — it is passed verbatim to dbt.

#### Scenario: Valid JSON vars accepted

- **WHEN** a task is created with `vars` set to a valid JSON object string (e.g. `{"dt": "2024-01-01"}`)
- **THEN** the system SHALL accept the value unchanged

#### Scenario: Invalid JSON vars rejected

- **WHEN** a task is created with `vars` that is not valid JSON
- **THEN** the system SHALL reject creation with a validation error

### Requirement: Task CRUD API surface

The system SHALL expose a REST API under `/api/dbt/tasks`:
- `GET /api/dbt/tasks` — paginated list, filterable by `projectId`, optional `environmentId` and `command`. SHALL NOT return unbounded result sets.
- `POST /api/dbt/tasks` — create a task.
- `GET /api/dbt/tasks/:id` — fetch a single task.
- `PUT /api/dbt/tasks/:id` — update a task's mutable fields.
- `DELETE /api/dbt/tasks/:id` — soft-delete a task.

All routes SHALL require authentication. Route handlers SHALL remain thin (Zod validation → service call → JSON response) and SHALL NOT contain Drizzle queries or business logic.

#### Scenario: Paginated list with project filter

- **WHEN** an authenticated client requests `GET /api/dbt/tasks?projectId=5&limit=20&offset=0`
- **THEN** the system SHALL return `{ items, total, limit, offset }` containing only non-soft-deleted tasks of project 5, ordered by `createdAt` descending

#### Scenario: Unauthenticated request rejected

- **WHEN** an unauthenticated client calls any task CRUD endpoint
- **THEN** the system SHALL reject with an authentication error (HTTP 401)

#### Scenario: Delete is soft-delete

- **WHEN** an authenticated client sends `DELETE /api/dbt/tasks/:id`
- **THEN** the system SHALL set `deletedAt` on the task row and SHALL return success
- **AND** subsequent default queries SHALL no longer return that task

### Requirement: Task update constraints

The `PUT /api/dbt/tasks/:id` endpoint SHALL accept partial updates. If `environmentId` is changed, the new environment SHALL still be bound to the task's project; otherwise the update SHALL be rejected. If `name` is changed, the project-uniqueness constraint SHALL be re-validated.

#### Scenario: Changing environment to another project-bound environment

- **WHEN** a task under project `P` is updated with `environmentId=E2`
- **AND** `E2` is bound to `P`
- **THEN** the system SHALL persist the new `environmentId`

#### Scenario: Changing environment to a non-project-bound environment rejected

- **WHEN** a task under project `P` is updated with `environmentId=E3`
- **AND** `E3` is NOT bound to `P`
- **THEN** the system SHALL reject the update

### Requirement: Task run records

Each manual execution of a task SHALL produce exactly one **task run** record (`dbt_task_runs`) linked to the task via `taskId`. A run record SHALL capture: `status` (`queued | running | succeeded | failed | canceled`), nullable `exitCode`, nullable `errorMessage`, nullable `startedAt`, nullable `finishedAt`. Run records SHALL be readable via:
- `POST /api/dbt/tasks/:id/run` — create a run and trigger execution; SHALL return `{ runId, status: "queued" }` immediately without waiting for dbt to finish.
- `GET /api/dbt/tasks/:id/runs` — paginated list of runs for a task, filterable by `status`, ordered by `startedAt` descending.
- `GET /api/dbt/task-runs/:runId` — single run detail.

#### Scenario: Triggering a run returns immediately

- **WHEN** an authenticated client sends `POST /api/dbt/tasks/:id/run`
- **AND** the task is valid and runnable
- **THEN** the system SHALL respond promptly (HTTP 200/201) with a `runId` and `status: "queued"`
- **AND** SHALL NOT block the HTTP response on the dbt command finishing

#### Scenario: Paginated run history

- **WHEN** an authenticated client requests `GET /api/dbt/tasks/:id/runs?limit=20&offset=0&status=failed`
- **THEN** the system SHALL return paginated run records for that task whose status is `failed`, most recent first
