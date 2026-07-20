## ADDED Requirements

### Requirement: Execution prerequisites

Before executing a task, the system SHALL verify all of the following and SHALL refuse to start otherwise:
- The task exists, is not soft-deleted, and belongs to a non-soft-deleted project.
- The task's bound environment exists and its `status` is `active`.
- The task's bound environment `initializationStatus` is `initialized` (the venv is ready).
- The task's bound database connection still exists.

When prerequisites fail, the system SHALL reject the run request with a descriptive error and SHALL NOT create a `dbt_task_runs` record.

#### Scenario: Environment not initialized

- **WHEN** a run is requested for a task whose bound environment has `initializationStatus != initialized`
- **THEN** the system SHALL reject with a validation error and SHALL NOT create a run record

#### Scenario: Soft-deleted task cannot be run

- **WHEN** a run is requested for a task that has been soft-deleted
- **THEN** the system SHALL respond with a not-found error and SHALL NOT create a run record

### Requirement: Concurrent execution of the same task is rejected

The system SHALL prevent more than one concurrent execution of the same task. While a run for task `T` has `status` of `queued` or `running`, a new run request for `T` SHALL be rejected with a conflict error. Different tasks MAY execute concurrently.

#### Scenario: Second concurrent run of same task rejected

- **WHEN** task `T` already has a run with `status` in `{queued, running}`
- **AND** a new `POST /api/dbt/tasks/T/run` arrives
- **THEN** the system SHALL reject with a conflict error (HTTP 409) and SHALL NOT start a second execution

#### Scenario: Concurrent runs of different tasks allowed

- **WHEN** task `T1` is currently running
- **AND** a run is requested for a different task `T2`
- **THEN** the system SHALL accept and start the run for `T2`

### Requirement: Run lifecycle state machine

A run record SHALL progress through the state machine `queued → running → (succeeded | failed | canceled)`. The system SHALL create the run in `queued`, transition to `running` once the child process is spawned, and transition to a terminal state exactly once. Terminal transitions SHALL set `finishedAt`. On successful process exit the terminal state SHALL be `succeeded` with `exitCode` populated. On non-zero exit, timeout, or thrown error, the terminal state SHALL be `failed` with `exitCode` (where available) and a non-empty `errorMessage`. Transitions out of a terminal state SHALL NOT occur.

#### Scenario: Successful execution reaches succeeded

- **WHEN** the dbt child process for a run exits with code 0
- **THEN** the run record SHALL be updated to `status=succeeded`, `exitCode=0`, and `finishedAt` set
- **AND** no further state transitions SHALL occur for that run

#### Scenario: Failed execution reaches failed

- **WHEN** the dbt child process exits with a non-zero code, times out, or the execution throws
- **THEN** the run record SHALL be updated to `status=failed`, `exitCode` set when known, `errorMessage` set to a non-empty message, and `finishedAt` set

### Requirement: Realtime log streaming

While a run is executing, the system SHALL publish realtime events on the topic `task:<runId>:run` via the in-process event bus (consumed by the WebSocket server). Events SHALL include:
- `status` — published on lifecycle transitions (e.g. `running`).
- `log` — published for each line of the child process's stdout / stderr, carrying `{ stream: "stdout" | "stderr", line: string }`.
- `done` — published exactly once when the run reaches a terminal state, carrying `{ status, error? }`.

Events SHALL be forwarded to subscribed WebSocket clients. Logs SHALL NOT be buffered unboundedly on the client; the frontend SHALL cap retained log lines (target cap: 500 most recent lines).

#### Scenario: Log lines streamed per line

- **WHEN** the dbt child process writes a line to stdout or stderr during a run
- **THEN** the system SHALL publish a `log` event on topic `task:<runId>:run` with the stream name and line content
- **AND** a WebSocket client subscribed to that topic SHALL receive the event

#### Scenario: Terminal done event published once

- **WHEN** a run reaches a terminal state
- **THEN** the system SHALL publish exactly one `done` event on `task:<runId>:run` with `{ status, error? }`
- **AND** SHALL NOT publish additional `done` events for that run

### Requirement: Project workspace instantiation per run

For each run, the system SHALL materialize a temporary on-disk workspace directory containing the project's files (directories from `dbt_directories` and files from `dbt_files`, excluding soft-deleted entries), plus a generated `profiles.yml` and a `dbt_project.yml`. The dbt command SHALL be invoked with `--project-dir` and `--profiles-dir` pointing at this workspace. The workspace directory SHALL be isolated per run (so concurrent runs do not collide). The system SHALL clean up the workspace directory when the run finishes (terminal state), and SHALL NOT persist its path beyond the run's lifetime.

#### Scenario: Workspace is created per run and isolated

- **WHEN** two runs of two tasks under the same project execute concurrently
- **THEN** each run SHALL use a distinct workspace directory and SHALL NOT write into the other's workspace

#### Scenario: Workspace cleaned up after run

- **WHEN** a run reaches a terminal state
- **THEN** the system SHALL remove that run's workspace directory from disk
- **AND** SHALL NOT retain a reference to it in the run record

#### Scenario: Latest DB content reflected

- **WHEN** a user edits a file in the project and then triggers a run
- **THEN** the materialized workspace SHALL contain the latest non-soft-deleted file contents from `dbt_files`

### Requirement: dbt profiles.yml generation

The system SHALL generate a `profiles.yml` in the run workspace whose structure is a single profile with a single `default` target. The top-level profile key SHALL be derived from the project's name (slugified). The connection data SHALL be resolved through the task's bound runtime environment: `task.environmentId → dbt_runtime_environments.connectionId → dbt_database_connections`. The decrypted password and all connection fields (host, port, databaseName, schemaName, username, extraConfig) SHALL be written into `outputs.default`. The generated `dbt_project.yml` SHALL reference the same profile name in its `profile:` field. The system SHALL NOT introduce a separate project-level or task-level connection binding — the connection is always inherited from the chosen runtime environment.

#### Scenario: Profile name derives from project name

- **WHEN** a run is executed for a project whose name is `"My Analytics Project"`
- **THEN** the generated `profiles.yml` SHALL have a top-level key that is the slugified project name (e.g. `my-analytics-project`)
- **AND** the generated `dbt_project.yml` SHALL set `profile:` to the same slugified name

#### Scenario: Single target named default

- **WHEN** a `profiles.yml` is generated for any run
- **THEN** it SHALL contain exactly one target under `outputs`, named `default`
- **AND`target:` SHALL be set to `default`

#### Scenario: Connection fields come from the environment's bound connection

- **WHEN** a run uses a task whose environment `E` is bound to connection `C`
- **THEN** the `outputs.default` section SHALL be populated with `C.host`, `C.port`, `C.username`, the decrypted value of `C.encryptedPassword`, `C.databaseName` as `dbname`, and `C.schemaName` as `schema` (or an adapter-appropriate default when `schemaName` is null)

#### Scenario: Task's --target argument is overridden

- **WHEN** a task has a non-empty `target` field AND is executed
- **THEN** the system SHALL still generate only the `default` target in `profiles.yml`
- **AND** SHALL NOT pass a `--target` that points to a non-existent target (the run SHALL resolve against `default`)

### Requirement: dbt command construction

The system SHALL construct the dbt invocation as `<venvPath>/bin/dbt <command>` (or the platform-equivalent binary) with arguments derived from the task: `--select` (when `select` set), `--exclude` (when `exclude` set), `--full-refresh` (when `fullRefresh` true), `--vars <vars>` (when `vars` set). The system SHALL always append `--project-dir <workspace>`, `--profiles-dir <workspace>`, and `--no-use-colors`. Arguments SHALL be passed as an array to the child process (not via a shell string) to avoid shell injection. The dbt binary SHALL be resolved from the bound runtime environment's venv (its `venvPath`).

**Phase-1 `--target` handling**: Because the generated `profiles.yml` contains only the `default` target (see "dbt profiles.yml generation"), the system SHALL NOT pass `--target` to dbt in phase 1 — even when the task has a non-empty `target` field — so the run resolves against the single `default` target. The `target` field is still accepted and stored for future use when multi-target profiles are introduced.

#### Scenario: Selectors and flags assembled from task

- **WHEN** a task with `command=run`, `select="my_model+"`, `fullRefresh=true`, `vars='{"dt":"2024-01-01"}'` is executed
- **THEN** the spawned command SHALL include the arguments `run --select my_model+ --full-refresh --vars {"dt":"2024-01-01"} --project-dir <workspace> --profiles-dir <workspace> --no-use-colors`

#### Scenario: Venv binary used

- **WHEN** a task is executed against environment `E`
- **THEN** the dbt binary SHALL be the one inside `E.venvPath` (not a system-wide dbt)

### Requirement: Stale run reconciliation

The system SHALL provide a mechanism to reconcile run records left in an active state (`queued` or `running`) due to process crash or server restart. A run whose `status` is `queued` or `running` and whose `createdAt` is older than a defined threshold (default 1 hour) SHALL be transitioned to `failed` with an `errorMessage` indicating the process was interrupted. Age is measured against `createdAt` (not `startedAt`) so that runs stuck in `queued` — where `startedAt` is null because the process crashed before transitioning to `running` — are also reconciled. This reconciliation SHALL run lazily (e.g. when listing runs) AND SHALL run once on task-execution module load to recover from process restarts; proactive background scheduling is otherwise out of scope.

#### Scenario: Long-stuck running run is reconciled

- **WHEN** the system lists runs and encounters a run with `status=running` and `createdAt` older than the threshold (default 1 hour)
- **THEN** the system SHALL transition that run to `failed` with an `errorMessage` indicating interruption
- **AND** the reconciled run SHALL appear as `failed` in subsequent listings

#### Scenario: Stuck queued run is reconciled

- **WHEN** a run's process crashed between creating the `queued` row and transitioning it to `running`, leaving a row with `status=queued` and `startedAt=null`
- **AND** that row's `createdAt` is older than the threshold
- **THEN** the system SHALL transition that run to `failed` so the task is no longer blocked by `findActiveRunOfTask`

#### Scenario: Reconciliation runs on module load

- **WHEN** the task-execution service module is loaded (e.g. after a server restart)
- **THEN** the system SHALL invoke `reconcileStaleRuns` once to recover any active-state runs orphaned by the previous process
