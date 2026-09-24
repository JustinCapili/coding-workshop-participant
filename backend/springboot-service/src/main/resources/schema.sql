-- Schema for springboot-service.
--
-- Spring runs this on every application startup (spring.sql.init.mode=always), which on Lambda means
-- every cold start. Every statement is therefore written to be a no-op the second time.
--
-- Names are schema-qualified on purpose. The JDBC URL sets currentSchema=springboot_service, but on a
-- fresh database that schema does not exist yet, so unqualified names would have nowhere to resolve.
--
-- IF NOT EXISTS matches on the object NAME, never on its shape. Adding a column here will not alter a
-- table that already exists: Postgres sees the name, does nothing, and reports success, and the
-- mismatch only surfaces later as a query failing on a column that this file appears to declare.
-- While the data is disposable the fix is DROP SCHEMA springboot_service CASCADE and a restart. Once
-- it is not disposable, that is the point to move to Flyway.

CREATE SCHEMA IF NOT EXISTS springboot_service;

CREATE TABLE IF NOT EXISTS springboot_service.employee (
    -- One identity for every member of staff, whatever their role.
    employee_id      TEXT PRIMARY KEY,

    -- Role is data rather than structure, so a promotion is an UPDATE rather than a row moving
    -- between tables and losing every reference to it.
    -- The allowed values are enforced by employee_role_check below, not inline, so that a database
    -- created before EMPLOYEE existed picks up the new value too.
    role             TEXT NOT NULL,

    email            TEXT NOT NULL UNIQUE,

    -- BCrypt digest, never a password. Nothing should write a plaintext value into this column.
    password_hash    TEXT NOT NULL,

    -- Self-referencing: the faculty admin managing this engineer. ON DELETE SET NULL is what keeps a
    -- deleted admin from leaving engineers pointing at somebody who no longer exists.
    faculty_admin_id TEXT REFERENCES springboot_service.employee (employee_id) ON DELETE SET NULL,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Only engineers are managed. A faculty admin reporting to another faculty admin is not something
    -- the Java model can express, so the database should not allow it either.
    CONSTRAINT employee_only_engineers_are_managed
        CHECK (faculty_admin_id IS NULL OR role = 'ENGINEER')
);

-- Postgres does not index the referencing side of a foreign key automatically, and
-- GET /faculty-admins/{id}/engineers searches on exactly this column.
CREATE INDEX IF NOT EXISTS employee_faculty_admin_id_idx
    ON springboot_service.employee (faculty_admin_id);

-- The role check, dropped and re-added on every start. An older database carries it inline under
-- Postgres's generated name, employee_role_check, without EMPLOYEE; a CREATE TABLE IF NOT EXISTS
-- would never update that. Replacing it by name is idempotent and needs no DO block, which the
-- statement splitter would cut apart at its semicolons.
ALTER TABLE springboot_service.employee DROP CONSTRAINT IF EXISTS employee_role_check;
ALTER TABLE springboot_service.employee ADD CONSTRAINT employee_role_check
    CHECK (role IN ('EMPLOYEE', 'ENGINEER', 'FACULTY_ADMIN'));


CREATE TABLE IF NOT EXISTS springboot_service.report (
    report_id  TEXT PRIMARY KEY,

    title      TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
    body       TEXT NOT NULL DEFAULT '',

    -- Required on every report. NOT NULL is free while the table is new, and far cheaper than
    -- backfilling later, since this script can only create and never alter.
    location   TEXT NOT NULL CHECK (length(btrim(location)) BETWEEN 1 AND 200),

    -- The set of legal values is something SQL enforces well. Which moves between them are legal
    -- is not: a CHECK cannot see the previous value, so transitions are enforced in ReportStatus.
    -- A new report is UNASSIGNED until a faculty admin puts somebody on it.
    status     TEXT NOT NULL DEFAULT 'UNASSIGNED'
               CHECK (status IN ('UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS',
                                 'SUBMITTED', 'APPROVED', 'ARCHIVED')),

    -- Provenance only. Permission never derives from this column, so losing it when an employee is
    -- deleted costs a piece of history rather than creating a way in.
    author_id  TEXT REFERENCES springboot_service.employee (employee_id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Who may do what to one particular report, and who is working it. A faculty admin is implicitly an
-- admin over everything and needs no row for that; a row naming one means they took the case
-- themselves, which is a grant they issued to themselves (assignee_id = assigned_by).
CREATE TABLE IF NOT EXISTS springboot_service.report_assignment (
    report_id    TEXT NOT NULL
                 REFERENCES springboot_service.report (report_id) ON DELETE CASCADE,

    -- CASCADE rather than SET NULL, and deliberately so: if an employee_id is ever reused, the new
    -- holder must not inherit the previous one's grants.
    assignee_id  TEXT NOT NULL
                 REFERENCES springboot_service.employee (employee_id) ON DELETE CASCADE,

    -- ADMIN is absent on purpose. Admin rights come from being a faculty admin, never from a grant,
    -- so no grant can hand out the power to issue further grants.
    access_level TEXT NOT NULL DEFAULT 'VIEWER'
                 CHECK (access_level IN ('VIEWER', 'CONTRIBUTOR', 'MANAGER')),

    -- The faculty admin who issued it. The grant outlives them; only the audit trail is lost.
    -- Null also encodes a grant nobody issued, which is how an author gets access to their own work.
    assigned_by  TEXT REFERENCES springboot_service.employee (employee_id) ON DELETE SET NULL,

    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One grant per person per report, as a fact of the database rather than a convention.
    PRIMARY KEY (report_id, assignee_id)
);

-- The primary key already answers "who is on this report". This answers the question asked on every
-- write: "what may this person do?"
CREATE INDEX IF NOT EXISTS report_assignment_assignee_idx
    ON springboot_service.report_assignment (assignee_id);

-- Older databases carry a CHECK (assignee_id <> assigned_by) that forbade self-grants. Faculty admins
-- now take cases themselves, and only a faculty admin can issue a grant (ReportService enforces it),
-- so the rule is gone.
ALTER TABLE springboot_service.report_assignment
    DROP CONSTRAINT IF EXISTS report_assignment_no_self_grant;

CREATE INDEX IF NOT EXISTS report_author_idx
    ON springboot_service.report (author_id);

-- Added after the table first shipped, so these are ALTERs rather than part of CREATE TABLE: ADD
-- COLUMN IF NOT EXISTS is what reaches a database that already has the report table. Nullable, since
-- reports filed before these existed have neither, and both are optional on create.
ALTER TABLE springboot_service.report ADD COLUMN IF NOT EXISTS incident_type TEXT
    CHECK (incident_type IN ('FACILITIES', 'IT', 'SAFETY', 'OTHER'));
ALTER TABLE springboot_service.report ADD COLUMN IF NOT EXISTS priority TEXT
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

-- A report's activity thread: comments, plus the system events (status moves, assignments,
-- requests) that are shown between them. Append-only; nothing updates a row here.
CREATE TABLE IF NOT EXISTS springboot_service.report_activity (
    activity_id TEXT PRIMARY KEY,

    report_id   TEXT NOT NULL
                REFERENCES springboot_service.report (report_id) ON DELETE CASCADE,

    kind        TEXT NOT NULL CHECK (kind IN ('COMMENT', 'STATUS', 'ASSIGNMENT', 'REQUEST')),

    -- Provenance only, like report.author_id: the thread keeps the entry, not the name.
    author_id   TEXT REFERENCES springboot_service.employee (employee_id) ON DELETE SET NULL,

    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The thread is always read whole, for one report, in order.
CREATE INDEX IF NOT EXISTS report_activity_report_idx
    ON springboot_service.report_activity (report_id, created_at);

-- Things a faculty admin has been asked to confirm: an engineer wanting an unassigned report, or
-- an author wanting their report closed. Approving is what moves the report; the row records that
-- it was asked for and decided.
CREATE TABLE IF NOT EXISTS springboot_service.report_request (
    request_id   TEXT PRIMARY KEY,

    report_id    TEXT NOT NULL
                 REFERENCES springboot_service.report (report_id) ON DELETE CASCADE,

    type         TEXT NOT NULL CHECK (type IN ('ASSIGNMENT', 'CLOSE')),

    -- CASCADE: a request from somebody who has left has nobody to grant it to.
    requested_by TEXT NOT NULL
                 REFERENCES springboot_service.employee (employee_id) ON DELETE CASCADE,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    status       TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED')),

    -- The admin who decided. The decision outlives them; only the audit trail is lost.
    resolved_by  TEXT REFERENCES springboot_service.employee (employee_id) ON DELETE SET NULL,
    resolved_at  TIMESTAMPTZ,

    -- A decision names who made it and when; a pending request has neither.
    CONSTRAINT report_request_resolution_complete
        CHECK ((status = 'PENDING') = (resolved_at IS NULL))
);

-- The queue every faculty admin dashboard reads: what is still pending?
CREATE INDEX IF NOT EXISTS report_request_status_idx
    ON springboot_service.report_request (status, requested_at);
