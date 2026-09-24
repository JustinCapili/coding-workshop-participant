# springboot-service

A Spring Boot service modelling staff roles and tracking which engineers each faculty admin manages.

## The model

```
User (abstract — email, password)
└── Employee (employeeId)
    ├── Engineer     — knows its managing FacultyAdmin
    └── FacultyAdmin — tracks the Engineers it manages
```

Everyone is identified by a single `employeeId`, which is also the repository key and the path
variable in every URL.

The management link is bidirectional and is kept in sync by exactly two methods,
`FacultyAdmin.addEngineer` and `FacultyAdmin.removeEngineer`. `Engineer.setFacultyAdmin` is
package-private, so no code outside `com.example.classes` can set one side of the link without the
other. `Engineer.assignTo` and `Engineer.unassign` exist for convenience and delegate to those two.

Adding an engineer who already has an admin moves them: the previous admin releases them first, so an
engineer is never held by two admins.

## Endpoints

Reachable at both `/faculty-admins` and `/api/springboot-service/faculty-admins`, because the local
dev proxy strips the `/api/springboot-service` prefix and CloudFront does not. See
`controller/ApiPaths.java`.

| Verb | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/` | anyone | health check |
| POST | `/faculty-admins` | admin@acme.inc, or nobody while no admin exists | create an admin (see *Bootstrapping*) |
| PUT | `/faculty-admins/{employeeId}` | admin@acme.inc | make an employee or engineer a faculty admin (see *Promoting to faculty admin*) |
| GET | `/faculty-admins` | anyone signed in | list admins |
| GET | `/faculty-admins/{employeeId}` | anyone signed in | one admin, with their engineers |
| GET | `/faculty-admins/{employeeId}/engineers` | anyone signed in | the engineers that admin manages |
| PUT | `/faculty-admins/{employeeId}/engineers/{engineerEmployeeId}` | that admin | assign an engineer (moves them if needed) |
| DELETE | `/faculty-admins/{employeeId}/engineers/{engineerEmployeeId}` | that admin | unassign; 409 if another admin manages them |
| POST | `/engineers` | admin, own team only | create an engineer, optionally under the caller |
| GET | `/engineers` | anyone signed in | list engineers, optionally `?facultyAdminId=` |
| GET | `/engineers/{employeeId}` | anyone signed in | one engineer |
| DELETE | `/engineers/{employeeId}` | their admin | delete, releasing them from their admin first |
| POST | `/employees/{employeeId}/promote` | any admin | make a plain employee an engineer on the caller's team (see *Promoting an employee*) |

Example (the first admin on a database the seeder has not run against, so no token yet; normally
`admin@acme.inc` is seeded instead, see *Bootstrapping*):

```sh
curl -X POST http://localhost:3001/api/springboot-service/faculty-admins \
     -H "Content-Type: application/json" \
     -d '{"email":"fa1@acme.inc","password":"pw","employeeId":"FA1"}'
```

Every new account, whichever endpoint creates it, must have an `@acme.inc` address; anything else is
400 `email must be an @acme.inc address`. The domain must match exactly, ignoring case, so
`x@sub.acme.inc` and `x@acme.inc.example.com` are refused. Accounts that already exist under another
address keep signing in. The rule lives in `auth/CompanyAccounts`.

Responses never include passwords — the records in `model/` have no password field, so one cannot leak
by accident.

## Signing in

`POST /auth/login` with `{"email", "password"}` answers `{"token", "expiresAt", "user"}` or 401. The
token is a JWT (`auth/TokenService`): a compact JWS signed with HMAC-SHA256, carrying `sub` (the
employee id), `email`, `role`, `pwd`, `iat` and `exp`. `pwd` (password) is an HMAC of the
employee's stored password digest, never the digest itself; see *Changing your password* for what it
is for. The token is valid for 12 hours and is sent back on every
other request as `Authorization: Bearer <token>`. Only HS256 is accepted when verifying, so a token
whose header says `none` or anything else is refused before its signature is looked at. The claims
are for the client's convenience: the server looks the employee up on every request, so deleting
someone stops their token at once and a role change shows up on their next call.

`POST /auth/refresh` with a still-valid token answers the same shape with a new token, so a client
in use never has to ask for the password again; once a token has expired the answer is 401 and the
user signs in again. `GET /auth/me` returns who the token holder is now. There is no logout
endpoint: tokens are stateless, so signing out is the client forgetting its token.

Tokens are signed with `AUTH_TOKEN_SECRET`; when that is unset the key is derived from
`POSTGRES_PASS` (the one secret every Lambda environment shares), and when neither exists a random
per-process key is used and a warning logged. Set `AUTH_TOKEN_SECRET` before relying on sessions in
the cloud.

```sh
TOKEN=$(curl -s -X POST http://localhost:3001/api/springboot-service/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"fa1@acme.inc","password":"pw"}' | jq -r .token)
curl http://localhost:3001/api/springboot-service/auth/me -H "Authorization: Bearer $TOKEN"
```

### Changing your password

Anyone signed in can change their own password, whatever their role. The website does it in two
steps from the avatar menu → **Settings** (`/settings`):

| Verb | Path | Body | Answers |
| --- | --- | --- | --- |
| POST | `/auth/verify-password` | `{"password"}` | 204 when it is the caller's current password; 403 when it is not; 400 when blank. Changes nothing. |
| PUT | `/auth/password` | `{"currentPassword", "newPassword"}` | 200 with a fresh `{"token", "expiresAt", "user"}`; 403 for a wrong current password; 400 for a blank field, a new password under 8 characters, or one equal to the current password |

The current password is checked again on the change itself, so the verify step is a convenience for
the form, not a gate. A wrong current password is 403 rather than 401 on purpose: the caller's token
is fine, and the frontend treats any 401 as a lost session and signs out.

**A change signs out every other session.** Each token's `pwd` claim fingerprints the password digest
it was issued under, and `AuthInterceptor` compares it with the digest stored now. A new password is
a new digest, so every earlier token — other browsers, other tabs, and anyone else who knew the old
password — gets 401 `Your password was changed; sign in again` on its next request, and cannot be
refreshed either. The response carries a token for the new password, so the browser that made the
change stays signed in. Tokens issued before `pwd` existed have no such claim and are refused too, so
everyone signs in again once after this is first deployed.

```sh
curl -X PUT http://localhost:3001/api/springboot-service/auth/password \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"currentPassword":"pw","newPassword":"a-longer-password"}'
```

### Who may call what

Every endpoint except the health check and `/auth/login` requires a token; that is enforced by
`auth/AuthInterceptor`, registered on `/**` in `config/WebMvcConfig` (an interceptor, not a filter,
for the reason recorded under *Booting the deployed artifact*). `bin/proxy-server.js` forwards the
`Authorization` header for this; CloudFront already does through its all-viewer origin request
policy. A missing or bad token is 401 with a `WWW-Authenticate: Bearer` header; a valid token for
somebody who may not do the thing is 403. Both carry the usual `{"status", "error", "message"}` body.

The two roles are `ENGINEER` and `FACULTY_ADMIN`, and the rules are few:

- Anyone signed in can read the directory: admins, engineers, and who manages whom.
- Only the default admin, **admin@acme.inc**, can make a faculty admin, by creating one or by
  promoting an employee or engineer. Every other faculty admin gets 403
  `Only admin@acme.inc can …`. The check needs both the `FACULTY_ADMIN` role and that address, so an
  account holding the address in any other role does not qualify.
- Only a faculty admin can create an engineer, delete an engineer, or promote a plain employee to
  engineer (always onto their own team).
- An admin acts only on their own team. Naming another admin's id when creating an engineer, or
  using another admin's `/faculty-admins/{id}/engineers/...` path, is 403. Deleting an engineer takes
  the admin who manages them; an unmanaged engineer belongs to nobody, so any admin may claim or
  delete one.
- What each role may do to a report is listed under *Reports*.

Role checks go through `Caller.requireFacultyAdmin`, `Caller.requireDefaultAdmin` and
`Caller.requireOwnTeam`, and the report rules through `service/ReportService`, so there is one place
each kind of refusal is worded.

### Promoting an employee

`POST /employees/{employeeId}/promote` makes a self-registered plain employee an engineer on the
calling admin's team. It answers 200 with the engineer, 404 when nobody has that id, and 409 when the
id is already an engineer's or a faculty admin's. The website does this from Create Engineer, by id;
everyone can see their own id in the account menu and on Settings.

It is the same account with a new role: the row's `role` changes in place (`EmployeeController.promote`
saves the engineer before deleting the employee entry, which in PostgreSQL deletes nothing; see the
comment there for why the order matters). The id, email, password and the reports they filed carry
over. Their tokens stay valid, since the password digest they are tied to is unchanged, and the new
role applies from their next request.

Their reports move with them. Filed by somebody on no team, they were visible to every admin and
engineer; now they are on the promoting admin's team, and other teams stop seeing them. A pending
assignment request on one of those reports from another team's engineer can then only be declined.

### Promoting to faculty admin

`PUT /faculty-admins/{employeeId}` makes a plain employee or an engineer a faculty admin. Only
admin@acme.inc may call it; anyone else gets 403 before the id is even looked up, so a refusal says
nothing about whether the id exists. It answers 200 with the new admin, 404 when nobody has that id,
and 409 when they are a faculty admin already. The website does this from **Faculty Admins**
(`/team/admins`), which only admin@acme.inc sees.

As with promoting an employee, it is the same row with a new `role`: `FacultyAdminController.promote`
saves the admin before deleting the old entry, which in PostgreSQL matches nothing. The id, email,
password, reports and assignments carry over, open sessions stay valid, and the new role applies
from the next request. An engineer leaves the team they were on, since a faculty admin is managed by
nobody.

### Bootstrapping

Nothing can sign in until a faculty admin exists, so `POST /faculty-admins` is the one call that
works without a token — and only while there is no admin at all (`@AllowAnonymous` on the
controller method, which is the only use of that annotation). The first person to call it on a fresh
database owns the service; from then on every admin is made by the default admin. Deploy, create
the first admin, and the door is shut.

**That step is done for you, locally and in AWS.** On startup `config/DefaultAdminSeeder` creates
the default admin, faculty admin **`admin@acme.inc`** (`ADM-001`), with password `password`, or
`DEFAULT_ADMIN_PASSWORD` if set. This is the same login the frontend's mock mode offers. It does
nothing if any account already has that email, so it is safe on every Lambda cold start. After
`bin/deploy-backend.sh` and `bin/deploy-frontend.sh`, sign in to the website as admin@acme.inc /
`password`. Because an admin now exists, the anonymous bootstrap call above is closed: sign in as
admin@acme.inc to make further admins.

Databases seeded before the move to acme.inc hold ADM-001 as `admin@acme.com`. On the first start
after the change the seeder renames that account to admin@acme.inc in place, so it keeps whatever
password it had, its reports and its team, and admin@acme.com stops working as a login. Only that
exact account is renamed: a faculty admin with id ADM-001 and the old address.

> **The deployed login is public knowledge.** The CloudFront URL is open to anyone, and Terraform
> does not pass `DEFAULT_ADMIN_PASSWORD` to the Lambda, so anyone who finds the site can sign in as
> admin@acme.inc / `password`. Change it from Settings after your first sign-in (see *Changing your
> password*): that also signs out anyone else who got in with it, and the seeder never puts the old
> password back, since it skips an email that already has an account.

## Reports

Visibility follows teams: a team is a faculty admin plus the engineers they manage, and a report is
on a team when its author or any assignee is. Authors always see their own reports, engineers see
their team's, faculty admins see everything on theirs. Two actions go through the admin rather than
happening directly — an engineer asking to work a report, and an author asking to close one — and
are recorded in `report_request` until approved or declined. The rules live in
`service/ReportService`; the controller only translates HTTP.

| Verb | Path | Who | Purpose |
| --- | --- | --- | --- |
| GET | `/reports` | anyone signed in | list visible reports; `?status=&location=&from=&to=&completedBy=&completedOnly=&openOnly=` |
| POST | `/reports` | anyone signed in | file a report (`title`, `body`, `location`), UNASSIGNED |
| GET | `/reports/{reportId}` | can see it | one report with assignees, pending requests and the activity thread |
| POST | `/reports/{reportId}/comments` | can see it | add to the thread |
| PATCH | `/reports/{reportId}/status` | assignee / admin | move through the lifecycle; engineers may only start and submit |
| PUT | `/reports/{reportId}/assignees` | admin | set the complete assignee set; status follows the grant table |
| POST | `/reports/{reportId}/assignment-requests` | engineer | ask to be put on an UNASSIGNED report |
| POST | `/reports/{reportId}/close-requests` | author | ask for the report to be closed |
| GET | `/reports/requests?status=PENDING` | admin | the approval queue, split by kind |
| POST | `/reports/assignment-requests/{id}/approve` · `/decline` | admin | decide an engineer's request |
| POST | `/reports/close-requests/{id}/approve` · `/decline` | admin | decide a close; approval walks the report forward to ARCHIVED |
| GET | `/reports/stats` | admin | dashboard counts for the team |

Approving a close never skips a state: an ASSIGNED report is moved through IN_PROGRESS, SUBMITTED and
APPROVED to ARCHIVED, each step in the thread, and an UNASSIGNED one is refused (409) until somebody
is put on it. Illegal moves are 409, a missing thing 404, a bad body 400, no token 401, and a thing the
caller may not do 403.

The `Who` column is what the server enforces; the token's `role` claim is only there so a client
can pick a dashboard without a second request.

## Storage

The `Jdbc*` repositories in `repos/` store everything in PostgreSQL (`schema.sql` creates the
`employee`, `report`, `report_assignment`, `report_activity` and `report_request` tables on start).
The `InMemory*` implementations are wired in only under the `test` profile: they keep everything in a
map inside one process, which on Lambda would mean data that disappears when the execution
environment is recycled and is never shared with another one. They exist so the controller tests
run without a database, not as a deployment option.

## Running it locally

```sh
cd backend/springboot-service
mvn spring-boot:run -Dspring-boot.run.profiles=local
```

Up on port 3001 in about a second and a half. Both path prefixes are mapped, so either shape works:

```sh
curl http://localhost:3001/
curl -X POST http://localhost:3001/faculty-admins \
     -H "Content-Type: application/json" \
     -d '{"email":"a@acme.inc","password":"pw","employeeId":"E1"}'
curl http://localhost:3001/api/springboot-service/faculty-admins/E1
```

3001 is the frontend's default `VITE_API_URL`, and the local profile allows CORS from
`http://localhost:3000` (`LocalCorsConfig`), so `cd frontend && npm run dev` talks to this run with
no further setup. `bin/proxy-server.js` also listens on 3001, so run this **or**
`./bin/start-dev.sh`, not both.

PostgreSQL needs no setup: outside Lambda the `POSTGRES_*` variables are absent, so
`DataSourceConfig` falls back to `localhost:5432/postgres`, and `schema.sql` creates the tables on
first start.

This is the inner loop. It does **not** exercise the Lambda entry point, the shaded jar, or the
proxy — for those, use `./bin/start-dev.sh`, and before deploying, the probe described below.

Two pieces of the setup are worth knowing about, because neither is installed by
`bin/setup-environment.sh`:

- **Tomcat** is a `provided` dependency, present only so `spring-boot:run` has a server to bind a
  port with. maven-shade packages compile and runtime scopes only, so it never reaches the deployed
  jar. If you ever see `org/apache/catalina` classes inside `target/springboot-service-1.0.0.jar`,
  something has changed that scope and the cold-start budget has quietly grown.
- **The `local` profile** excludes `ServerlessAutoConfiguration`, whose web server factory stands in
  for a server without opening a port. Without that exclusion the application starts and then
  silently serves nothing.

## Load testing

Artillery load tests live in [`loadtest/`](../../loadtest/README.md). `loadtest/start-backend.sh`
runs this service as above, but on port 8081 and a fresh throwaway database; `npm test` there runs
the load profile and checks the thresholds. The first run (2026-09-24) found the report list,
stats and queue endpoints slow down as reports accumulate, because `ReportService` reads every report
on each call; the README there has the numbers.

## Building

The service needs Maven and a JDK 21+; `bin/setup-environment.sh` installs both. Terraform builds and
deploys it automatically once `pom.xml` exists — it is discovered by being one level under `backend/`.

```sh
mvn test              # the JDBC classes skip themselves when nothing listens on localhost:5432
mvn clean package     # produces target/springboot-service-1.0.0.jar
```

Two build details are load-bearing and should not be "tidied":

- The artifact must stay named `springboot-service`, because `infra/locals.tf` keeps only
  `target/springboot-service*.jar`, deletes everything else, and moves the jar to `target/lib/`.
  That last step matters: the function code is the `target` directory, and the Java runtime only
  loads jars from `lib/` — a jar at the root gives `ClassNotFoundException: com.example.Handler`.
- The `maven-shade-plugin` transformers merge Spring's `META-INF` descriptors. `spring.factories`
  and `aot.factories` must use Spring Boot's `PropertiesMergingResourceTransformer`, not
  `AppendingTransformer`: their keys repeat across jars, appending leaves duplicate keys, and
  `Properties` keeps only the last. That once dropped the listener that loads
  `application.properties`, so on Lambda none of it applied (no `schema.sql`, default pool size,
  default JSON) while every test still passed. The filter block in
  `backend/_examples/java-service/pom.xml` deletes those descriptors wholesale; copying it here stops
  the application booting and takes the logs that would explain why with it.

`Handler.java` is the AWS Lambda entry point. Terraform hardcodes
`com.example.Handler::handleRequest` for every Java service, so its name and package are fixed.

## Booting the deployed artifact

`mvn test` runs against `target/classes` — loose class files, with each dependency loaded from its own
jar. What actually reaches AWS is `target/lib/springboot-service-1.0.0.jar`, the shaded jar, where those
same classes are flattened together and Spring's `META-INF` descriptors are merged. **No test ever
loads that file**, because Surefire runs before `package` produces it. A broken shade configuration
therefore passes the entire suite and fails on deploy.

Tests also reach Spring by a different road than Lambda does:

```
mvn test:   MockMvc -> DispatcherServlet
the jar:    Handler -> SpringDelegatingLambdaContainerHandler -> ServerlessMVC
                    -> ProxyFilterChain -> DispatcherServlet
```

So anything relying on servlet mechanics — filters, interceptors, authentication — has to be checked
here rather than in a MockMvc test, which would report success either way.

Compile a throwaway caller against the jar and invoke the handler with a Function URL v2 payload:

```java
var handler = new com.example.Handler();
String path = "/api/springboot-service";
String payload = "{\"version\":\"2.0\",\"rawPath\":\"" + path + "\","
    + "\"requestContext\":{\"http\":{\"method\":\"GET\",\"path\":\"" + path + "\"}},"
    + "\"headers\":{\"accept\":\"application/json\"}}";
var out = new java.io.ByteArrayOutputStream();
handler.handleRequest(new java.io.ByteArrayInputStream(payload.getBytes()), out, null);
System.out.println(out);
```

```sh
mvn -q clean package -DskipTests
javac -cp target/springboot-service-1.0.0.jar -d /tmp/probe Probe.java
java -Xmx128m -cp "target/springboot-service-1.0.0.jar:/tmp/probe" Probe
```

`-Xmx128m` matches the memory Terraform allocates; a `null` Lambda context is tolerated. This is the
last checkpoint before deploying, not a substitute for it — there is no Lambda runtime here, no CPU
throttling, no VPC and no init timeout.

**Verified with this recipe (2026-09-23):** both a registered servlet `Filter` and a Spring MVC
`HandlerInterceptor` execute inside the serverless container, and the full authentication path —
the interceptor on `/**`, the `@AllowAnonymous` bootstrap check on the handler method, and the
`Optional<Caller>` argument resolver — was probed the same way against the shaded jar: no token 401,
anonymous first admin 201, anonymous second admin 401, and the role refusals 403. Two caveats for filters, confirmed in the
container's bytecode: `addUrlPatterns(...)` is **silently ignored**, so every filter runs on every
request, and `@Order` is lost because the registrations live in a `HashMap`. Interceptors have neither
problem, and exceptions thrown from `preHandle` reach `@RestControllerAdvice` — so prefer them.
