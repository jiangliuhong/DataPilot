## ADDED Requirements

### Requirement: Repository methods accept optional transaction context

Any repository write method that participates in a multi-step write operation SHALL accept an optional trailing transaction-context parameter (`tx`) that, when provided, executes its statement against that transaction rather than the shared database singleton. When the parameter is omitted, the method SHALL fall back to the shared global `db` instance, preserving existing non-transactional call sites without change. Single-statement read queries are exempt (no behavioral consistency benefit). The parameter type SHALL be the shared `Database` type exported from the database module, so the contract is driver-agnostic (MySQL/SQLite).

#### Scenario: Repository write joins an in-flight transaction

- **WHEN** a service calls `db.transaction(async (tx) => { repo.softDeleteById(id, tx); })`
- **THEN** the repository's delete SHALL execute within that transaction (same connection / savepoint scope)
- **AND** if the transaction rolls back, the delete SHALL be rolled back too

#### Scenario: Repository write falls back to global db without tx

- **WHEN** a service calls `repo.softDeleteById(id)` with no `tx` argument
- **THEN** the repository SHALL execute against the shared global `db` singleton
- **AND** the statement SHALL commit immediately (legacy behavior preserved)

#### Scenario: Insert returning id supports transaction context

- **WHEN** the cross-driver `insertReturningId` helper is invoked with a `tx` argument
- **THEN** it SHALL perform the insert within that transaction and return the generated `{ id }`

### Requirement: Multi-step write operations execute atomically

Any service operation that performs more than one write whose combined effect must be consistent SHALL wrap those writes in a single `db.transaction(async (tx) => {...})` and pass `tx` to every participating repository call. If any step fails, the entire operation SHALL roll back, leaving no partial state. This requirement applies at minimum to: project deletion (soft-delete files, directories, and the project), directory rename/move with cascading path updates, directory deletion with cascading soft-delete, and project ZIP import.

#### Scenario: Project deletion is atomic across files, directories, and project

- **WHEN** a project is deleted and the soft-delete of its directories fails after files were soft-deleted
- **THEN** the soft-deleted files SHALL be rolled back (restored to non-deleted)
- **AND** the project SHALL remain non-deleted
- **AND** the operation SHALL surface the failure to the caller

#### Scenario: Directory rename updates all descendant paths atomically

- **WHEN** a directory is renamed and one descendant path update fails
- **THEN** all path updates for that rename SHALL be rolled back
- **AND** no descendant or file SHALL be left with a stale/inconsistent path

#### Scenario: ZIP import is all-or-nothing

- **WHEN** a ZIP import encounters an error partway through writing directory/file records
- **THEN** all directory and file records created during this import SHALL be rolled back
- **AND** the database SHALL reflect its pre-import state

### Requirement: Transaction logic resides in the service layer

Transaction boundaries SHALL be established only inside services, never in route handlers or repositories. Repositories SHALL expose transaction-aware write methods but SHALL NOT call `db.transaction` themselves. Route handlers SHALL remain thin (validate, call service, respond) and SHALL NOT open transactions or invoke repository methods directly in a transactional context.

#### Scenario: Route handler does not manage transactions

- **WHEN** a multi-step write is triggered through an API route
- **THEN** the route handler SHALL delegate to a service method
- **AND** the route handler SHALL NOT call `db.transaction` or pass a `tx` to repositories

#### Scenario: Repository does not self-open transactions

- **WHEN** a repository write method is invoked
- **THEN** it SHALL NOT internally call `db.transaction`; it SHALL only execute against the provided `tx` or the global `db`
