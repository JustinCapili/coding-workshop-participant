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
│   │   ├── utils/             # Formatting helpers
│   │   ├── App.jsx            # Route table
│   │   ├── main.jsx           # Providers (theme, router, auth, snackbar)
│   │   └── theme.js           # MUI theme
│   ├── .env.sample          # React environment variables
│   ├── eslint.config.js     # ESLint JS tool configuration
│   ├── index.html           # SPA shell
│   ├── package.json         # App metadata with dependencies
│   ├── README.md            # Frontend guide (YOU ARE HERE)
│   └── vite.config.js       # Vite build tool configuration
├── ...
```

## Routes

| Route | Who | Page |
| --- | --- | --- |
| `/login` | everyone | Employee email + password |
| `/dashboard` | all roles | Role-aware dashboard (Employee / Engineer / Faculty Admin) |
| `/reports/new` | all roles | Create Incident Report |
| `/settings` | all roles | Account settings (avatar menu → Settings): change your password in two steps |
| `/reports/:reportId` | all roles (scoped) | Report detail with activity thread and actions |
| `/reports/previous` | Engineer+ | Completed reports, filter by date / completing engineer |
| `/common-cases` | all roles | Reference links for recurring problems |
| `/inventory/request` | Engineer+ | Chat-style parts request (stubbed) |
| `/team/engineers/new` | Faculty Admin+ | Grant engineer permission by email |
| `/team/open-cases` | Faculty Admin+ | Approvals queue + assign/reassign open cases |

## Demo accounts

All accounts use the password `password`.

| Email | Role | Notes |
| --- | --- | --- |
| `alice@acme.com` | Employee | Team FA-001 |
| `eric@acme.com` | Employee | Team FA-002 |
| `bob@acme.com`, `carol@acme.com` | Engineer | Team FA-001 |
| `dave@acme.com` | Engineer | Team FA-002 |
| `frank@acme.com` | Faculty Admin | Manages FA-001 |
| `grace@acme.com` | Faculty Admin | Manages FA-002 |
| `admin@acme.com` | Admin | Faculty Admin with global scope (sees all teams) |

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

## Clean Up

To remove all deployed resources (including frontend):

```sh
./bin/cleanup-environment.sh
```

**Warning**: This removes all infra resources. Cannot be undone.
