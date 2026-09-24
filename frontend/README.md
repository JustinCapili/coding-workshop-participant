# Coding Workshop - Frontend Code

## Overview

This folder contains the React frontend for the ACME Inc. incident report app described in
[`docs/incident-report-frontend-spec.md`](../docs/incident-report-frontend-spec.md). It is a
Vite + React 19 single-page app using React Router for routing and Material UI for components.

The `src/services/` layer talks to `backend/springboot-service` over HTTP with a JWT bearer token.
Set `VITE_USE_MOCKS=true` in `.env.local` to run the whole UI on local mock data instead
(`src/services/mock/`), with the demo accounts below and state kept in `localStorage`. Use the
account menu's "Reset demo data" to start over; that menu item exists only in mock mode.

## Prerequisites

- React - JavaScript library for building user interfaces
- React Router - Client-side routing for React
- Material UI - Comprehensive UI component library

## Structure

```
coding-workshop-participant/
├── frontend/              # React frontend
│   ├── public/              # Public assets
│   ├── src/                 # Source code
│   │   ├── auth/              # AuthProvider, useAuth (session + role)
│   │   ├── components/        # Reusable components, grouped by feature
│   │   │   ├── common/          # StatusChip, PageHeader, ErrorAlert, ConfirmDialog, ...
│   │   │   ├── dashboard/       # StatTile, ActionCard
│   │   │   ├── feedback/        # Snackbar provider + hook
│   │   │   ├── layout/          # AppShell (header + role-aware sidebar), nav items
│   │   │   ├── reports/         # ReportCard/Grid/Filters, ActivityThread, AssignEngineerDialog, ...
│   │   │   └── routing/         # RequireAuth, RequireRole guards
│   │   ├── domain/            # Frontend mirrors of backend enums (ReportStatus, roles, options)
│   │   ├── hooks/             # useAsync, useSubmit
│   │   ├── pages/             # Route components (dashboard/, reports/, engineer/, team/)
│   │   ├── services/          # One facade per resource; picks api/ or mock/ from VITE_USE_MOCKS
│   │   │   ├── api/             # Real HTTP calls + normalize.js (adapts backend shapes for the UI)
│   │   │   └── mock/            # fixtures + persistent in-memory store (VITE_USE_MOCKS=true)
│   │   ├── test/              # Jest setup and render helpers (renderApp, renderWithProviders)
│   │   ├── utils/             # Formatting helpers
│   │   ├── App.jsx            # Route table
│   │   ├── main.jsx           # Providers (theme, router, auth, snackbar)
│   │   └── theme.js           # MUI theme
│   │                          # (*.test.js / *.test.jsx sit next to the file they test)
│   ├── e2e/                 # Selenium end-to-end specs (*.e2e.test.js) and support/ helpers
│   ├── .env.sample          # React environment variables
│   ├── eslint.config.js     # ESLint JS tool configuration
│   ├── index.html           # SPA shell
│   ├── jest.config.js       # Unit and component tests (jsdom, 80% coverage threshold)
│   ├── jest.e2e.config.js   # End-to-end tests (Selenium, real local stack)
│   ├── package.json         # App metadata with dependencies
│   ├── README.md            # Frontend guide (YOU ARE HERE)
│   └── vite.config.js       # Vite build tool configuration
├── ...
```

## Routes

| Route | Who | Page |
| --- | --- | --- |
| `/` | signed-out visitors | Landing page: a blueprint of the campus with sample incidents, the report lifecycle, the three roles, and the way in. Signed-in users go straight to `/dashboard` |
| `/login` | everyone | Employee email + password; `/login?mode=register` opens "Create an account" |
| `/dashboard` | all roles | Role-aware dashboard (Employee / Engineer / Faculty Admin) |
| `/reports/new` | all roles | Create Incident Report |
| `/settings` | all roles | Account settings (avatar menu → Settings): change your password in two steps |
| `/reports/:reportId` | all roles (scoped) | Report detail with activity thread and actions |
| `/reports/previous` | Engineer+ | Completed reports, filter by date / completing engineer |
| `/common-cases` | all roles | Reference links for recurring problems |
| `/inventory/request` | Engineer+ | Chat-style parts request (stubbed) |
| `/team/engineers/new` | Faculty Admin+ | Grant engineer permission by email |
| `/team/open-cases` | Faculty Admin+ | Approvals queue + assign/reassign open cases |
| `/team/admins` | admin@acme.inc only | Make an employee or engineer a Faculty Admin |

Creating an account ("Create an account" on the login page, or a new engineer) needs an
`@acme.inc` address; the form says so before asking the backend, which refuses anything else.
Accounts that already exist under another address still sign in. Only the default admin,
`admin@acme.inc`, can make faculty admins, so only they see **Faculty Admins** in the sidebar.

## Demo accounts

All accounts use the password `password`. The others keep their older `@acme.com` addresses, which
still sign in; only new accounts need `@acme.inc`.

| Email | Role | Notes |
| --- | --- | --- |
| `alice@acme.com` | Employee | Team FA-001 |
| `eric@acme.com` | Employee | Team FA-002 |
| `bob@acme.com`, `carol@acme.com` | Engineer | Team FA-001 |
| `dave@acme.com` | Engineer | Team FA-002 |
| `frank@acme.com` | Faculty Admin | Manages FA-001 |
| `grace@acme.com` | Faculty Admin | Manages FA-002 |
| `admin@acme.inc` | Admin | The default admin: Faculty Admin with global scope (sees all teams), and the only account that can make faculty admins |

## Swapping mocks for the real API

Each function in `src/services/*Service.js` carries a `TODO(backend)` comment naming the endpoint it
maps to. Replace the function body with a call through `src/services/http.js` (which reads
`VITE_API_URL` from `.env.local`), keep the signature, and the pages need no changes. The `viewer`
argument on report functions exists only so the mock can scope results; the backend will do that
from the bearer token.

## Usage

### Local Development

To run your application locally:

```sh
./bin/start-dev.sh
```

To view your application, open the browser and navigate to `http://localhost:3000`.

Lint and production build:

```sh
cd frontend
npm run lint
npm run build
```

### Cloud Deployment

To deploy your frontend to AWS:

```sh
./bin/deploy-frontend.sh
```

To view your application, open the browser and navigate to CloudFront URL.

## Testing

Two layers, both run by Jest:

| Command | What it runs | Needs |
| --- | --- | --- |
| `npm test` | Unit, API-integration and component tests in jsdom, with coverage. Fails under 80% on statements, branches, functions or lines. Also runs in CI (`.github/workflows/react.actions.yml`). | nothing |
| `npm run test:watch` | The same, re-running on change, without coverage | nothing |
| `npm run test:e2e` | Selenium end-to-end workflows in a real browser, against the real local stack | the local stack running |

### Unit and component tests (`npm test`)

Jest + React Testing Library. Tests sit next to the file they test (`LoginPage.jsx` →
`LoginPage.test.jsx`).

- **Logic:** `domain/` (roles, the status transition table), `utils/`, `hooks/`, the sidebar's
  `navItems`.
- **API integration:** `services/http.js` and `services/api/*` against a mocked `fetch`. Each
  service function sends exactly the method, path and body the backend expects. Responses are
  normalized, errors become `ApiError`, and a 401 signs the user out, except on `/auth/login`.
- **Mock backend:** `services/mock/*`, the in-browser backend that `VITE_USE_MOCKS=true` runs on.
  Covers visibility per role, the legal status moves and the 409s for illegal ones, assignment and
  close requests.
- **Components and pages:** every page and component. Pages are rendered as the whole app
  (`renderApp` in `src/test/renderApp.jsx`) at a route, signed in as a seeded account, on the mock
  backend. So a test drives the real page, services and routing: sign-in and registration,
  Settings' two-step password change, filing a report, every action on a report, the approval
  queues, the role guards. Error states come from the mock backend's real errors or from a
  rejected service call.

The setup (`src/test/setupEnv.js`, `setupTests.js`):
- `import.meta.env` is rewritten to `process.env` for Jest.
- The mock backend answers instantly.
- Every test starts from the seeded data with nobody signed in.
- A test that needs API mode mocks `services/config` (see the `*.api.test.jsx` files).

Latest run: **67 suites, 835 passed, 1 skipped** (the known bug below). Coverage: statements
99.78%, branches 98.83%, functions 99.79%, lines 100%.

### End-to-end tests (`npm run test:e2e`)

Selenium WebDriver drives a headless Firefox through the running app, UI → proxy → Spring Boot
Lambda on LocalStack → Postgres. Nothing is mocked.

```sh
./bin/start-dev.sh             # the stack: Vite on :3000, proxy on :3001, LocalStack, Postgres
cd frontend
npm run test:e2e
```

| Spec | Critical path |
| --- | --- |
| `auth.e2e.test.js` | Wrong password rejected; faculty admin sign-in; registration; sign-out; a deep link survives the trip through /login; unknown routes |
| `report-lifecycle.e2e.test.js` | Admin creates an engineer → employee files a report → engineer requests it → admin approves (Current Open Cases) → engineer starts, comments, submits → admin approves and archives → employee sees the outcome |
| `close-request.e2e.test.js` | Admin assigns from the Open cases table; the author asks to close; the admin confirms (archived) or declines (stays open, and can be asked again) |
| `password.e2e.test.js` | Two browsers signed in as one person; a two-step change in one; the other is signed out on its next request; only the new password works |
| `access.e2e.test.js` | The sidebar each role sees; the pages each role is refused; after a log-out, the next person starts on their own dashboard |

Latest run: **5 suites, 25 passed** in about 2 minutes.

- **Data:** each run creates its own uniquely named accounts and reports (a run id is in every
  email and title), so specs never depend on existing data or on each other's. The suite signs in
  as the seeded faculty admin to create engineers, and never changes its password.
- **Settings**, as environment variables:
  - `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`: that admin, if not `admin@acme.inc` / `password`
  - `E2E_BASE_URL`, `E2E_API_URL`: another frontend or proxy address
  - `E2E_BROWSER=chrome`
  - `E2E_HEADED=1` to watch the browser
- **Browser:** Selenium Manager downloads its own Firefox and geckodriver into
  `~/.cache/selenium` on the first run. Ubuntu's snap Firefox cannot be driven by geckodriver.
- **Failures:** a failed test saves a screenshot and the page source to `e2e/artifacts/`.
- Before any spec, the suite checks the stack is up and the admin can sign in, and says what to fix
  if not.

### Known gaps

- **One bug, pinned by a skipped test:** saving the Assign dialog unchanged drops assignees from
  outside the admin's team. They are not in the pick-list, so they are not pre-selected. How to
  fix it is a product decision: the backend only accepts engineers from the admin's own team.
  (`components/reports/AssignEngineerDialog.test.jsx`)
- **The mock backend is looser than the real one** in a few places the UI never reaches. It lets
  an admin assign an engineer from another team, and act on a report outside their scope. The
  end-to-end suite is what exercises the real rules.
- **Inventory requests** have no backend, so they are covered only in mock mode.
- **End-to-end tests are not in CI.** They need the LocalStack stack. Test data they create
  accumulates in the local database.
- **Not covered:** a handful of branches that cannot be reached through the UI (listed as
  uncovered lines in the coverage report). Cross-browser runs beyond Firefox and Chrome.

## Clean Up

To remove all deployed resources (including frontend):

```sh
./bin/cleanup-environment.sh
```

**Warning**: This removes all infra resources. Cannot be undone.
