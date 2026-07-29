## MODIFIED Requirements

### Requirement: Task name uniqueness within a project

The system SHALL enforce that the combination `(projectId, name)` is unique among non-soft-deleted tasks. Two tasks in different projects MAY share the same name. Uniqueness validation SHALL be performed by the service layer; the route handler SHALL NOT call the task repository directly to pre-check uniqueness (the service's check is the single source of truth).

#### Scenario: Duplicate name in same project rejected

- **WHEN** a task is created or renamed to a `name` that already exists for a non-soft-deleted task under the same `projectId`
- **THEN** the system SHALL reject the operation with a conflict error (HTTP 409)
- **AND** this uniqueness check SHALL be performed solely by the service, not duplicated in the route

#### Scenario: Same name allowed across projects

- **WHEN** a task is created with a `name` that exists under a different `projectId`
- **THEN** the system SHALL accept the creation

## ADDED Requirements

### Requirement: Task target field is phase-1 reserved

The `target` field on a task SHALL be accepted and persisted for forward compatibility, but in phase 1 it SHALL NOT influence dbt command construction or profile generation. The frontend task form SHALL NOT expose a `target` input to the user. The schema SHALL mark `target` as optional with a "phase-1 reserved" annotation. Multi-target profile support is out of scope for this phase.

#### Scenario: Target is not exposed in the task form

- **WHEN** a user creates or edits a task through the frontend task form
- **THEN** the form SHALL NOT render a `target` input field
- **AND** SHALL NOT send `target` in the request body

#### Scenario: Persisted target does not affect the command

- **WHEN** a task with a non-empty persisted `target` value is executed
- **THEN** the constructed dbt command SHALL NOT include a `--target` argument
- **AND`profiles.yml` SHALL still contain only the `default` target
