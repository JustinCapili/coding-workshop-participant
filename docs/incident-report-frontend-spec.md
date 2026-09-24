# Incident Report App — Frontend Spec (ACME Inc.)

> Companion to the [Full Stack Guide](./full-stack.md). Scopes the React frontend for the incident
> report system whose domain model already exists in
> [`backend/springboot-service`](../backend/springboot-service/README.md) (`Employee` → `Engineer` /
> `FacultyAdmin`, `Report`, `ReportStatus`, `ReportAssignment`, `AccessLevel`).

## Roles

Three roles exist in the current backend model. "Faculty Admin" and "Manager" refer to the same
role (`FacultyAdmin`). A fourth tier, **Admin** (all-employee visibility across every faculty
admin's team), is described in the source notes but has no backend counterpart yet — see
[Open Questions](#open-questions).

| Role | Backend type | Summary |
| --- | --- | --- |
| Employee | `Employee` | Files incident reports, tracks their own reports' progress. |
| Engineer | `Engineer` | Employee + can request assignment to open reports, browse closed reports for reference. |
| Faculty Admin / Manager | `FacultyAdmin` | Engineer's superset: dashboard stats, manages their engineer team, assigns/approves reports. |
| Admin | *(not yet modeled)* | Manager superset: visibility across all employees, not just their own team. |

## Global

### Login

- Fields: **Employee Email**, **Password**.
- Single login form for all roles — the backend resolves role from the employee record; the
  frontend routes post-login by role (Employee/Engineer dashboard vs Faculty Admin dashboard).
- No separate signup flow is specified for Employees/Engineers; Faculty Admins provision engineers
  (see [Create Engineer Tab](#create-engineer-tab)). Confirm with stakeholders whether
  self-service account creation is in scope before building it.

### Layout shell

- Top-level authenticated layout: header (branding, current user, logout) + role-aware content
  area, with a role-aware **sidebar**. Every role sees Dashboard and Common Cases; engineers and
  above get their own entries on top of those.

---

## Employee

### Dashboard (grid)

- Card/grid layout, two primary entry points:
  - **Create Incident Report**
  - **Look at previous report statuses** (the employee's own reports, with current `ReportStatus`)

### Create Incident Report page

Form fields:

- **Title** — free text, author-entered.
- **Type of incident** — dropdown (enum TBD with stakeholders, e.g. Facilities, IT, Safety, Other).
- **Priority** — dropdown (e.g. Low / Medium / High / Critical).
- **Location** — room number / floor, free text (maps to `Report.location`).
- Submission creates a `Report` in `ReportStatus.UNASSIGNED`, authored by the current employee.

### Incident Report detail page

- **Title**
- **Current status** — one of `UNASSIGNED / ASSIGNED / IN_PROGRESS / SUBMITTED / APPROVED / ARCHIVED`.
- **Assignee(s)** — who (if anyone) is assigned, from `ReportAssignment`.
- **Chat / activity thread** — GitHub-issue-style comment feed showing the reporting employee,
  assigned engineer(s), and status-change events inline.
- **Close** action available to the author — does not archive immediately; sends a close request
  that a Faculty Admin must confirm (keeps `ARCHIVED` a Faculty-Admin-driven transition per
  `ReportStatus`, where the forward moves out of `APPROVED` are the only path to `ARCHIVED`).

---

## Engineer

Inherits everything above (login, dashboard, report detail, chat), plus:

### Dashboard (grid) — extended

- List of **current incidents**, filterable by **location** and **status**.
- Engineers can **request** any open (`UNASSIGNED`) incident; the request routes to the managing
  Faculty Admin for confirmation rather than assigning immediately (mirrors
  `FacultyAdmin.addEngineer`-style admin-mediated assignment, applied to reports).

### Sidebar

- **Previous Reports** tab
- **Common Cases**
- **Request Inventory**

#### Previous Reports tab

- Grid layout matching the dashboard's visual style.
- Reports filtered by **date** and by **engineer who completed** the incident (`ARCHIVED`/`APPROVED`
  reports, read-only — used for finding prior solutions).

#### Common Cases

- Dropdown/menu of secondary links to reference pages answering common recurring problems.
  Content source TBD (static content vs CMS-backed).

#### Request Inventory

- Query box (URL- or chat-style input) for requesting parts/inventory needed to resolve an
  incident. Backend contract TBD — no inventory service exists yet; stub the UI against a
  placeholder endpoint.

---

## Manager / Faculty Admin

Inherits everything from Engineer, plus:

### Dashboard (grid) — extended

- Lists **current incidents** across the admin's team.
- Statistics tiles: possible incidents for the day, available engineers (headcount not currently
  on an active assignment), etc.
- Each incident row/card has an **Assign Engineer(s)** action (maps to
  `PUT /faculty-admins/{employeeId}/engineers/{engineerEmployeeId}`-style assignment, extended to
  reports via `ReportAssignment`).

### Sidebar

- **Create Engineer** tab
- **Current Open Cases**

#### Create Engineer tab

- Input: **employee email**.
- Grants Engineer permissions to that email (backed by
  `POST /faculty-admins/{employeeId}/engineers` or `POST /engineers` under this admin).

#### Current Open Cases

- All non-`ARCHIVED` reports for the admin's team, with the ability to:
  - Approve engineer requests for a report (the "request to work an incident" flow from
    [Engineer](#dashboard-grid--extended)).
  - Approve employee-submitted close requests (`SUBMITTED`/`APPROVED` → `ARCHIVED`).
  - Assign/reassign engineers to a report.

---

## Admin

- Everything in Manager/Faculty Admin, but scoped **across all employees/teams**, not just the
  admin's own engineers. No backend role currently distinguishes this from `FacultyAdmin` — see
  [Open Questions](#open-questions).

---

## Cross-cutting notes for implementation

- **Data model alignment**: build the frontend's `Report` types against the existing backend
  fields (`reportId, title, body, location, status, authorId, createdAt, updatedAt`) plus
  assignment records (`reportId, assigneeId, accessLevel, assignedBy, assignedAt`). "Type of
  incident" and "priority" from the Employee create form are **not yet backend fields** — add them
  to the request payload only once the backend supports them, or track them client-side/in `body`
  as a stopgap.
- **Missing backend endpoints**: there is currently no `ReportController` (report CRUD/assignment)
  and no auth/login endpoint in `springboot-service` — only `FacultyAdminController` and
  `EngineerController` exist. Build the frontend `services/` layer against the contract this doc
  implies, backed by mock data/local fixtures until those endpoints land, so UI work isn't blocked.
- **Stack**: React + Vite (existing scaffold), add React Router for the routes below and Material
  UI for components, per `frontend/README.md`'s stated prerequisites (neither is installed yet).
- **Follow the existing project layout** from [`frontend/README.md`](../frontend/README.md) rather
  than restructuring: page components go under `src/pages/`, shared UI under `src/components/`, and
  all HTTP calls behind `src/services/` (an API client module per backend service, mirroring
  `springboot-service`'s `/faculty-admins`, `/engineers`, and future `/reports` routes). Do not
  scaffold a new app — extend the current one in place.
- `index.html` is the SPA shell the README calls the "Landing page"; the actual landing experience
  (login, then role-routed dashboard) is the app's `/` route rendered through `App.jsx`, not
  separate static HTML.
- Local dev and deploy continue to go through the existing tooling —
  `./bin/start-dev.sh` (serves at `http://localhost:3000`) and `./bin/deploy-frontend.sh` — so the
  build must keep working under Vite's existing `vite.config.js` without bypassing it.
- **Suggested routes**:
  - `/login`
  - `/dashboard` (role-aware)
  - `/reports/new`
  - `/reports/:reportId`
  - `/reports/previous` (Engineer+)
  - `/common-cases` (all roles)
  - `/inventory/request` (Engineer+)
  - `/team/engineers/new` (Faculty Admin+)
  - `/team/open-cases` (Faculty Admin+)

## Open Questions

1. Is **Admin** a distinct backend role, or Faculty Admin with a global-scope flag?
2. Does Employee/Engineer signup happen anywhere, or is every account Faculty-Admin-provisioned?
3. What are the enum values for **incident type** and **priority**?
4. What backs **Request Inventory** — a real service, or static content for the workshop?
5. Is the "close" confirmation flow a new `ReportStatus`, or handled as an assignment/comment
   event layered on the existing states?
