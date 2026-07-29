## ADDED Requirements

### Requirement: dbt parse pre-check before task run

Before spawning the actual dbt command for a task run, the system SHALL run `dbt parse` against the materialized run workspace using the bound runtime environment's venv, and SHALL treat a parse failure as a run failure (without proceeding to the full command). The parse step SHALL reuse the same materialized workspace and venv used by the run, introducing no additional project state on disk. Parse SHALL complete in seconds under normal conditions; it is a syntactic/reference validation pass only, not a data build.

#### Scenario: Parse failure aborts the run before the full command

- **WHEN** a task run is triggered and `dbt parse` against the materialized workspace reports errors (e.g. broken `ref()`/`source()` or malformed YAML)
- **THEN** the run record SHALL transition directly to `failed` with an `errorMessage` derived from the parse output
- **AND** the system SHALL NOT spawn the task's actual dbt command (run/build/test/etc.)

#### Scenario: Parse success allows the run to proceed

- **WHEN** `dbt parse` completes with exit code 0
- **THEN** the system SHALL proceed to spawn the task's configured dbt command against the same workspace

#### Scenario: Parse reuses the run workspace and venv

- **WHEN** the pre-run parse executes
- **THEN** it SHALL use the workspace directory already materialized for this run and the dbt binary from the task's bound environment venv
- **AND`--project-dir`/`--profiles-dir` SHALL point at that same workspace

### Requirement: Structured validation of AI-written file content

When the AI agent writes or edits project files through the virtual file system backend, the system SHALL validate the content against the dbt file-type conventions before persisting to `dbt_files`. YAML files (`.yml`/`.yaml`) SHALL be validated for syntactic correctness and the presence of required dbt schema fields (e.g. `name` on each model/source entry). SQL files (`.sql`) SHALL be checked for basic Jinja bracket balance and for obviously raw table references where `ref()`/`source()` is expected. Validation failure SHALL prevent persistence and SHALL surface a structured error back to the agent so it can self-correct, rather than blocking on human approval.

#### Scenario: Invalid YAML is rejected and fed back to the agent

- **WHEN** the AI agent writes a `.yml` file whose content is syntactically invalid YAML or is missing a required `name` field on a model entry
- **THEN** the system SHALL NOT persist the file
- **AND** SHALL return a structured validation error to the agent describing the problem
- **AND** the agent SHALL have the opportunity to rewrite the file

#### Scenario: Malformed SQL Jinja is rejected

- **WHEN** the AI agent writes a `.sql` file with unbalanced Jinja delimiters (e.g. `{{ ref('x')` without closing braces)
- **THEN** the system SHALL NOT persist the file and SHALL return a validation error to the agent

#### Scenario: Valid content is persisted normally

- **WHEN** the AI agent writes a `.yml` or `.sql` file that passes validation
- **THEN** the system SHALL persist the content to `dbt_files` (subject to the existing HITL approval flow for write operations)
