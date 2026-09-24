# Load testing

[Artillery](https://www.artillery.io/) load tests for `springboot-service`, covering the workshop's
*Performance Testing* expectations (`docs/full-stack.md`):
- load on the API endpoints under concurrent use
- monitoring of response times and the server's resource use

## Running it

```sh
cd loadtest
npm install
./start-backend.sh          # terminal 1: the service on :8081, fresh throwaway database
npm run smoke               # terminal 2: 15 s check that every scenario works
npm test                    # terminal 2: the full load profile, about 5 minutes
```

`start-backend.sh` runs the service as a plain local server (the `local` profile) on port 8081.
- It drops and recreates the `springboot_loadtest` database each time.
- Every run starts from the same state: the tables plus the seeded `admin@acme.inc`.
- Your local `postgres` database, the LocalStack stack and the dev proxy on 3001 are not touched.

`npm test` / `npm run smoke` (`run.js`):
1. Checks the target answers.
2. Seeds the accounts the scenarios use (`seed.js`: 20 employees, 5 engineers, the admin). Each
   employee files one report, so the read scenarios have data from the start.
3. Samples the server's CPU and memory from `/proc` once a second, when the target is a process on
   this machine.
4. Runs Artillery (`scenarios.yml`).
5. Writes `results/<time>.json` (raw) and `results/<time>-summary.md` (the tables below).
6. Exits 1 if a threshold is missed. The smoke run applies no thresholds.

Other targets, through environment variables (see `config.js`):

```sh
# The local stack the website uses (dev proxy → Lambda on LocalStack). Keep the load low: each
# concurrent Lambda is a 1 GB container.
TARGET=http://localhost:3001 BASE_PATH=/api/springboot-service ADMIN_PASSWORD=… npm run smoke

# The AWS deployment. Real numbers, but real load and cost on the account, and test data in the
# cloud database.
TARGET=https://<cloudfront-domain> BASE_PATH=/api/springboot-service npm test
```

## What it does

Each virtual user is one person's short session: they sign in once, make a few requests with
one-second pauses, as the website would. Four kinds of session, by weight:

| Session | Weight | Requests |
| --- | ---: | --- |
| Employee files and follows a report | 5 | `POST /auth/login`, `POST /reports`, `GET /reports/{id}`, `POST /reports/{id}/comments`, `GET /reports` |
| Engineer browses open reports | 3 | `POST /auth/login`, `GET /reports?openOnly=true`, `GET /reports/{id}`, `GET /engineers` |
| Admin checks the dashboard | 2 | `POST /auth/login`, `GET /reports/stats`, `GET /reports/requests?status=PENDING`, `GET /engineers?facultyAdminId=` |
| Health check | 1 | `GET /` |

**Load profile** (sessions started per second):

| Phase | Duration | Sessions started per second |
| --- | --- | --- |
| Warm-up | 30 s | 2 |
| Ramp | 60 s | 2 → 10 |
| Sustained | 120 s | 10 |
| Spike | 30 s | 20 |

**Thresholds** (`run.js`), checked per endpoint so one slow endpoint cannot hide among fast ones:
- p95 under 500 ms.
- `POST /auth/login` p95 under 1500 ms. BCrypt is slow on purpose, and every session starts with it.
- Error rate (non-2xx responses and failed requests) under 1%.

## Results, 2026-09-24

**Environment:**
- One service instance on a 2-vCPU VM that was already busy: load average about 2 before the test,
  from LocalStack, the dev server and other sessions. Local PostgreSQL.
- The service ran as configured for Lambda. That includes a 2-connection database pool, which is
  right for one request per Lambda at a time but limits a single server handling many at once.

**Verdict: the thresholds failed.** Over the whole run, 8,846 requests (30/s on average) from 2,220
sessions:
- 253 requests failed, all client time-outs after 30 s (`ERR_SOCKET_TIMEOUT`) during and after the
  spike: 2.86% of requests.
- There were **no error responses**. The service slowed down but never returned a 5xx.
- The server process used 90% of one core on average (163% at peak) and at most 630 MB of memory;
  the load average peaked at 16.

| Endpoint | Requests | p50 ms | p95 ms | p99 ms |
| --- | ---: | ---: | ---: | ---: |
| `POST /auth/login` | 2037 | 478 | 12460 | 15526 |
| `POST /reports` | 1021 | 99 | 14917 | 15840 |
| `GET /reports/{id}` | 1384 | 44 | 14622 | 15526 |
| `POST /reports/{id}/comments` | 1021 | 105 | 14622 | 15526 |
| `GET /reports` | 1021 | 743 | 17859 | 20543 |
| `GET /reports?openOnly` | 363 | 169 | 24595 | 28291 |
| `GET /reports/stats` | 400 | 327 | 15219 | 16160 |
| `GET /reports/requests` | 400 | 103 | 14622 | 15526 |
| `GET /engineers` | 363 | 7 | 340 | 743 |
| `GET /engineers?facultyAdminId` | 400 | 66 | 14332 | 14917 |
| `GET /` | 183 | 5 | 11051 | 14622 |

Where it degraded (10-second windows, condensed):

| t (s) | Sessions started per second | Requests/s | p50 ms | p95 ms | Failed |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 22 | 2 | 8 | 7 | 86 | 0 |
| 52 | 5.6 | 24 | 10 | 111 | 0 |
| 92 | 10 | 42 | 13 | 180 | 0 |
| 132 | 10 | 43 | 29 | 347 | 0 |
| 172 | 10 | 41 | 584 | 2417 | 0 |
| 192 | 10 | 40 | 573 | 3135 | 0 |
| 212 | 20 | 48 | 2516 | 6312 | 24 |
| 232 | 16 | 38 | 9230 | 12712 | 31 |
| 252 | 0 (draining) | 20 | 15219 | 19738 | 36 |

## What the numbers say

1. **Capacity on this machine is about 40–48 requests/s, roughly 8–10 sessions per second.** Up to
   there, p95 stays under 500 ms. Above it, requests queue. The 20/s spike then pushes waits past
   the 30 s client time-out.
2. **The cost of the list endpoints grows with the data.** That is why latency kept climbing even
   while the arrival rate held steady at 10/s.
   - `ReportService` reads every report on every `GET /reports`, `GET /reports/stats` and
     `GET /reports/requests` call (`findAll()` at `ReportService.java` lines 208, 257 and 290),
     filters in memory, and returns the whole visible list with no paging.
   - During the run each employee session filed a report, about 1,000 in all. With no load at all
     afterwards, `GET /reports?openOnly` took about 200 ms and returned 455 KB, against 21 ms on
     the fresh database. `GET /engineers`, which doesn't grow, stayed at 5 ms.
3. **Sign-in is CPU-heavy by design.** BCrypt costs about 100 ms of CPU per sign-in, and every
   session starts with one. On two shared cores that is a large part of the budget.
4. **It fails safe.** Under overload the service answered slowly rather than with errors, and it
   recovered once the load stopped.

**Recommendations**, most effective first:
- Page and filter the report lists in SQL (`WHERE` and `LIMIT`) rather than in memory.
- Compute `GET /reports/stats` with `COUNT` queries.
- Rerun against the AWS deployment for real capacity numbers. Lambda scales by running more
  instances, which a single local server cannot show.

## Known gaps

- **Not in CI.** It needs a running backend and Postgres, and minutes of load.
- **These numbers are for one local instance on a shared 2-vCPU machine.** They are not a
  measurement of the deployed Lambda, which scales out per request. The AWS run above has not been
  done yet.
- **Test data is created.** It lands in the throwaway `springboot_loadtest` database, which the
  next `start-backend.sh` recreates.
- **Artillery's dependency tree** has 2 moderate `npm audit` findings and no high ones. It lives here,
  not in `frontend/`, so the frontend's CI audit is unaffected.
