## ADDED Requirements

### Requirement: AI-written file content is validated before persistence

When files are written or edited through the AI agent's virtual file system backend (the path-addressed write path used by the agent, distinct from the manual file CRUD endpoints), the system SHALL run content validation against dbt file-type conventions before persisting to `dbt_files`. Validation rules: YAML (`.yml`/`.yaml`) SHALL be syntactically valid and contain required dbt schema fields (e.g. `name` on model/source entries); SQL (`.sql`) SHALL have balanced Jinja delimiters and SHALL flag obviously raw table references where `ref()`/`source()` is expected. A validation failure SHALL prevent persistence and return a structured error to the agent for self-correction. This requirement does not change the manual file CRUD behavior (create/update via the REST endpoints), which continues to apply its existing validations.

#### Scenario: AI-written invalid YAML is rejected before persistence
- **WHEN** the AI agent writes a `.yml` file through the virtual file system backend and the content fails YAML or dbt schema validation
- **THEN** the system SHALL NOT persist the file
- **AND** SHALL return a structured validation error to the agent

#### Scenario: AI-written malformed SQL Jinja is rejected
- **WHEN** the AI agent writes a `.sql` file through the virtual file system backend with unbalanced Jinja delimiters
- **THEN** the system SHALL NOT persist the file and SHALL return a validation error to the agent

#### Scenario: Manual file CRUD is unaffected
- **WHEN** a user creates or updates a file via the REST endpoints (POST/PUT /api/dbt/projects/:id/files...)
- **THEN** the existing file-type and duplicate-name validations SHALL apply unchanged
- **AND`dbt-content` structured validation SHALL NOT alter this path's accepted inputs
