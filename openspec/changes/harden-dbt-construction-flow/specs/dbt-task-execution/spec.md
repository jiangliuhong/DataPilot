## MODIFIED Requirements

### Requirement: dbt command construction

The system SHALL construct the dbt invocation as `<venvPath>/bin/dbt <command>` (or the platform-equivalent binary) with arguments derived from the task: `--select` (when `select` set), `--exclude` (when `exclude` set), `--full-refresh` (when `fullRefresh` true), `--vars <vars>` (when `vars` set). The system SHALL always append `--project-dir <workspace>`, `--profiles-dir <workspace>`, and `--no-use-colors`. Arguments SHALL be passed as an array to the child process (not via a shell string) to avoid shell injection. The dbt binary SHALL be resolved from the bound runtime environment's venv (its `venvPath`).

**Phase-1 `--target` handling**: Because the generated `profiles.yml` contains only the `default` target (see "dbt profiles.yml generation"), the system SHALL NOT pass `--target` to dbt in phase 1 — even when the task has a non-empty `target` field — so the run resolves against the single `default` target. The `target` field is still accepted and stored for future use when multi-target profiles are introduced; this decision (formerly `design.md` R14) is now fixed in spec. See also the dbt-task-management capability "Task target field is phase-1 reserved".

#### Scenario: Selectors and flags assembled from task
- **WHEN** a task with `command=run`, `select="my_model+"`, `fullRefresh=true`, `vars='{"dt":"2024-01-01"}'` is executed
- **THEN** the spawned command SHALL include the arguments `run --select my_model+ --full-refresh --vars {"dt":"2024-01-01"} --project-dir <workspace> --profiles-dir <workspace> --no-use-colors`

#### Scenario: Venv binary used
- **WHEN** a task is executed against environment `E`
- **THEN** the dbt binary SHALL be the one inside `E.venvPath` (not a system-wide dbt)

#### Scenario: Target argument is omitted in phase 1
- **WHEN** a task with a non-empty `target` field is executed
- **THEN** the constructed command SHALL NOT include `--target`

## ADDED Requirements

### Requirement: dbt_project.yml source preference and profile consistency

When materializing the run workspace, the system SHALL prefer a `dbt_project.yml` that exists as a managed project file (e.g. one imported with the project) over an auto-generated one. The system SHALL auto-generate a minimal `dbt_project.yml` only when no such file exists in the project. When the system uses a project-provided `dbt_project.yml`, it SHALL validate that the file's `profile:` field equals the slugified project name (the same key used as the top-level profile in the generated `profiles.yml`); on mismatch the system SHALL abort the run with a descriptive error and SHALL NOT proceed, to prevent connecting to an unintended target.

#### Scenario: Imported dbt_project.yml is used when present
- **WHEN** a project contains a managed `dbt_project.yml` file and a run is materialized
- **THEN** the workspace SHALL use that file's content as the `dbt_project.yml`
- **AND`--project-dir` SHALL point at the workspace containing it

#### Scenario: Auto-generate only when absent
- **WHEN** a project has no managed `dbt_project.yml` file
- **THEN** the system SHALL generate a minimal `dbt_project.yml` referencing the slugified project name profile

#### Scenario: Mismatched profile name aborts the run
- **WHEN** a project-provided `dbt_project.yml` declares a `profile:` that does not equal the slugified project name
- **THEN** the system SHALL abort the run with a descriptive error
- **AND`profiles.yml` SHALL NOT be generated for a different profile name
- **AND** the run SHALL NOT proceed to spawn dbt

### Requirement: dbt parse pre-check before command spawn

Prior to spawning the task's configured dbt command, the system SHALL execute `dbt parse` against the materialized workspace (see the dbt-construction-validation capability). A failed parse SHALL short-circuit the run to `failed` without invoking the full command.

#### Scenario: Run fails fast on parse error
- **WHEN** `dbt parse` reports errors during a task run
- **THEN** the run record SHALL transition to `failed` with the parse error
- **AND** the task's actual dbt command SHALL NOT be spawned
