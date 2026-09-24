package com.example.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.repos.EmployeeRepository;
import com.example.repos.EngineerRepository;
import com.example.repos.FacultyAdminRepository;
import com.example.repos.ReportActivityRepository;
import com.example.repos.ReportAssignmentRepository;
import com.example.repos.ReportRepository;
import com.example.repos.ReportRequestRepository;
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Exercises signing in and the report endpoints against the in-memory repositories.
 *
 * Same harness as {@link DirectoryControllerTest}, and for the same reasons. Every test starts from
 * two teams: FA1 manages E1 and E2, FA2 manages E3. Tokens are obtained through the login endpoint,
 * so the interceptor and argument resolver are exercised on every request rather than bypassed.
 */
@SpringBootTest(properties = {
    "spring.autoconfigure.exclude="
        + "org.springframework.cloud.function.serverless.web.ServerlessAutoConfiguration",
    "spring.sql.init.mode=never"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class ReportControllerTest {

    /** Performs the requests. */
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private EngineerRepository engineerRepository;

    @Autowired
    private FacultyAdminRepository facultyAdminRepository;

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ReportAssignmentRepository assignmentRepository;

    @Autowired
    private ReportActivityRepository activityRepository;

    @Autowired
    private ReportRequestRepository requestRepository;

    /** Bearer tokens for the seeded staff, keyed by employee id. */
    private String fa1;
    private String fa2;
    private String e1;
    private String e2;
    private String e3;

    @BeforeEach
    void seedTwoTeams() throws Exception {
        requestRepository.deleteAll();
        activityRepository.deleteAll();
        assignmentRepository.deleteAll();
        reportRepository.deleteAll();
        employeeRepository.deleteAll();
        engineerRepository.deleteAll();
        facultyAdminRepository.deleteAll();

        // The first admin is the bootstrap call and needs no token; everyone after is provisioned
        // by a signed-in admin, each engineer by the admin who will manage them.
        createAdmin("FA1", null);
        fa1 = login("FA1");
        createAdmin("FA2", fa1);
        fa2 = login("FA2");
        createEngineer("E1", "FA1", fa1);
        createEngineer("E2", "FA1", fa1);
        createEngineer("E3", "FA2", fa2);

        e1 = login("E1");
        e2 = login("E2");
        e3 = login("E3");
    }

    @Nested
    @DisplayName("signing in")
    class SigningIn {

        @Test
        @DisplayName("a correct password returns a token and the user, never the password")
        void loginReturnsTokenAndUser() throws Exception {
            mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"E1@acme.inc\",\"password\":\"pw\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.user.employeeId").value("E1"))
                .andExpect(jsonPath("$.user.role").value("ENGINEER"))
                .andExpect(jsonPath("$.user.facultyAdminId").value("FA1"))
                .andExpect(jsonPath("$.user.password").doesNotExist());
        }

        @Test
        @DisplayName("email is matched ignoring case, and admins have no facultyAdminId")
        void loginIgnoresEmailCase() throws Exception {
            mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"Admin@ACME.inc\",\"password\":\"pw\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("FACULTY_ADMIN"))
                .andExpect(jsonPath("$.user.facultyAdminId").doesNotExist());
        }

        @Test
        @DisplayName("a wrong password and an unknown email get the same 401")
        void badCredentialsAreIndistinguishable() throws Exception {
            String wrongPassword = mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"E1@acme.inc\",\"password\":\"nope\"}"))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

            String unknownEmail = mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"nobody@acme.inc\",\"password\":\"pw\"}"))
                .andExpect(status().isUnauthorized())
                .andReturn().getResponse().getContentAsString();

            assertThat(unknownEmail).isEqualTo(wrongPassword);
        }

        @Test
        @DisplayName("a blank field is a 400")
        void blankFieldIsBadRequest() throws Exception {
            mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"E1@acme.inc\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("password must not be blank"));
        }

        @Test
        @DisplayName("/auth/me identifies the token holder on both path prefixes")
        void meReturnsTheCaller() throws Exception {
            mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + e2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeId").value("E2"));

            mockMvc.perform(get("/api/springboot-service/auth/me")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + fa1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeId").value("FA1"));
        }

        @Test
        @DisplayName("no token, a tampered token and a deleted account are all 401")
        void unusableTokensAreUnauthorized() throws Exception {
            mockMvc.perform(get("/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));

            mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + e1 + "x"))
                .andExpect(status().isUnauthorized());

            mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Basic abc"))
                .andExpect(status().isUnauthorized());

            createEngineer("E9", "FA1", fa1);
            String e9 = login("E9");
            mockMvc.perform(as(fa1, delete("/engineers/E9"))).andExpect(status().isNoContent());
            mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + e9))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Your account no longer exists"));
        }

        @Test
        @DisplayName("the token is a JWT, and login says when it expires")
        void tokenIsAJwtWithAnExpiry() throws Exception {
            String body = mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"E1@acme.inc\",\"password\":\"pw\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString();

            String token = JsonPath.read(body, "$.token");
            String[] parts = token.split("\\.");
            assertThat(parts).hasSize(3);
            String header = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            String claims = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            assertThat(header).isEqualTo("{\"alg\":\"HS256\",\"typ\":\"JWT\"}");
            assertThat((String) JsonPath.read(claims, "$.sub")).isEqualTo("E1");
            assertThat((String) JsonPath.read(claims, "$.role")).isEqualTo("ENGINEER");
            assertThat(Instant.parse(JsonPath.read(body, "$.expiresAt")).getEpochSecond())
                .isEqualTo(((Number) JsonPath.read(claims, "$.exp")).longValue());
        }

        @Test
        @DisplayName("a valid token can be refreshed; the new one works and reflects the caller")
        void refreshIssuesAWorkingToken() throws Exception {
            String body = mockMvc.perform(as(e1, post("/auth/refresh")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andExpect(jsonPath("$.user.employeeId").value("E1"))
                .andReturn().getResponse().getContentAsString();
            String refreshed = JsonPath.read(body, "$.token");

            mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + refreshed))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeId").value("E1"));

            mockMvc.perform(post("/auth/refresh"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"));
        }

        @Test
        @DisplayName("every report endpoint requires a token, on both path prefixes")
        void reportsRequireAToken() throws Exception {
            mockMvc.perform(get("/reports")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/api/springboot-service/reports"))
                .andExpect(status().isUnauthorized());
            mockMvc.perform(post("/reports")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"title\":\"t\",\"location\":\"l\"}"))
                .andExpect(status().isUnauthorized());
            mockMvc.perform(get("/reports/stats")).andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("changing your own password")
    class ChangingPassword {

        @Test
        @DisplayName("verify-password is 204 for the current password and 403, not 401, for a wrong one")
        void verifyChecksTheCurrentPassword() throws Exception {
            mockMvc.perform(as(e1, post("/auth/verify-password")).content("{\"password\":\"pw\"}"))
                .andExpect(status().isNoContent());

            mockMvc.perform(as(e1, post("/auth/verify-password")).content("{\"password\":\"nope\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));

            mockMvc.perform(as(e1, post("/auth/verify-password")).content("{\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("password must not be blank"));
        }

        @Test
        @DisplayName("both endpoints need a token")
        void changingRequiresAToken() throws Exception {
            mockMvc.perform(post("/auth/verify-password")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"password\":\"pw\"}"))
                .andExpect(status().isUnauthorized());

            mockMvc.perform(put("/auth/password")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(changeBody("pw", "brand-new-pw")))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("a change stores a new digest, returns a working token, and swaps which password signs in")
        void changeReplacesThePassword() throws Exception {
            String body = mockMvc.perform(as(e1, put("/auth/password"))
                    .content(changeBody("pw", "brand-new-pw")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andExpect(jsonPath("$.user.employeeId").value("E1"))
                .andExpect(jsonPath("$.user.password").doesNotExist())
                .andReturn().getResponse().getContentAsString();
            String fresh = JsonPath.read(body, "$.token");

            mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + fresh))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeId").value("E1"));

            assertThat(engineerRepository.findById("E1").orElseThrow().getPassword())
                .startsWith("$2a$")
                .doesNotContain("brand-new-pw");

            mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"E1@acme.inc\",\"password\":\"pw\"}"))
                .andExpect(status().isUnauthorized());
            mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"E1@acme.inc\",\"password\":\"brand-new-pw\"}"))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("every token issued before the change stops working, including for refresh")
        void changeSignsOutOtherSessions() throws Exception {
            String otherSession = login("E1");

            String body = mockMvc.perform(as(e1, put("/auth/password"))
                    .content(changeBody("pw", "brand-new-pw")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            String fresh = JsonPath.read(body, "$.token");

            for (String stale : new String[] {e1, otherSession}) {
                mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + stale))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.message").value("Your password was changed; sign in again"));
                mockMvc.perform(as(stale, post("/auth/refresh")))
                    .andExpect(status().isUnauthorized());
            }

            // Somebody else's session is untouched.
            mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + e2))
                .andExpect(status().isOk());
            mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + fresh))
                .andExpect(status().isOk());
        }

        @Test
        @DisplayName("a wrong current password is 403 and changes nothing")
        void wrongCurrentPasswordIsForbidden() throws Exception {
            mockMvc.perform(as(e1, put("/auth/password")).content(changeBody("nope", "brand-new-pw")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Current password is incorrect"));

            mockMvc.perform(get("/auth/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + e1))
                .andExpect(status().isOk());
            login("E1");
        }

        @Test
        @DisplayName("a blank, short, or unchanged new password is 400")
        void badNewPasswordsAreRejected() throws Exception {
            mockMvc.perform(as(e1, put("/auth/password")).content(changeBody("pw", "")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("newPassword must not be blank"));

            mockMvc.perform(as(e1, put("/auth/password")).content(changeBody("pw", "short")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("newPassword must be at least 8 characters"));

            mockMvc.perform(as(e1, put("/auth/password")).content(changeBody("", "brand-new-pw")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("currentPassword must not be blank"));

            String employee = registerEmployee("pat");
            mockMvc.perform(as(employee, put("/auth/password")).content(changeBody("password", "password")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("newPassword must differ from the current password"));

            login("E1");
        }

        @Test
        @DisplayName("an admin keeps their team and a plain employee can change theirs, on the cloud prefix too")
        void everyRoleCanChange() throws Exception {
            String body = mockMvc.perform(as(fa1, put("/api/springboot-service/auth/password"))
                    .content(changeBody("pw", "brand-new-pw")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("FACULTY_ADMIN"))
                .andReturn().getResponse().getContentAsString();
            String fresh = JsonPath.read(body, "$.token");
            mockMvc.perform(as(fresh, get("/faculty-admins/FA1/engineers")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

            String employee = registerEmployee("pat");
            mockMvc.perform(as(employee, put("/auth/password"))
                    .content(changeBody("password", "brand-new-pw")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("EMPLOYEE"));
        }

        private static String changeBody(String currentPassword, String newPassword) {
            return String.format(
                "{\"currentPassword\":\"%s\",\"newPassword\":\"%s\"}", currentPassword, newPassword);
        }
    }

    @Nested
    @DisplayName("filing and seeing reports")
    class FilingAndSeeing {

        @Test
        @DisplayName("a filed report is UNASSIGNED, authored by the caller, with a Location header")
        void createReturns201() throws Exception {
            mockMvc.perform(as(e1, post("/reports"))
                    .content("{\"title\":\"Projector dead\",\"body\":\"No light\","
                        + "\"location\":\"Room 204\"}"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/reports/RPT-")))
                .andExpect(jsonPath("$.reportId").value(startsWith("RPT-")))
                .andExpect(jsonPath("$.status").value("UNASSIGNED"))
                .andExpect(jsonPath("$.authorId").value("E1"))
                .andExpect(jsonPath("$.author.email").value("E1@acme.inc"))
                .andExpect(jsonPath("$.assignees").isEmpty())
                .andExpect(jsonPath("$.pendingAssignmentRequests").isEmpty())
                .andExpect(jsonPath("$.pendingCloseRequest").doesNotExist())
                .andExpect(jsonPath("$.activity").doesNotExist());
        }

        @Test
        @DisplayName("a missing title or location is a 400")
        void createValidates() throws Exception {
            mockMvc.perform(as(e1, post("/reports")).content("{\"title\":\" \",\"location\":\"l\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("title must not be blank"));
            mockMvc.perform(as(e1, post("/reports")).content("{\"title\":\"t\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("location must not be blank"));
        }

        @Test
        @DisplayName("a report is visible to its team and invisible to another team")
        void visibilityFollowsTeams() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");

            mockMvc.perform(as(fa1, get("/reports")))
                .andExpect(jsonPath("$.length()").value(1));
            mockMvc.perform(as(e2, get("/reports")))
                .andExpect(jsonPath("$.length()").value(1));
            mockMvc.perform(as(fa2, get("/reports")))
                .andExpect(jsonPath("$.length()").value(0));
            mockMvc.perform(as(e3, get("/reports")))
                .andExpect(jsonPath("$.length()").value(0));

            mockMvc.perform(as(e3, get("/reports/" + reportId)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403));
            mockMvc.perform(as(fa2, get("/reports/" + reportId)))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(e2, get("/reports/" + reportId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activity").isArray());
        }

        @Test
        @DisplayName("an unknown report is a 404")
        void unknownReportIsNotFound() throws Exception {
            mockMvc.perform(as(fa1, get("/reports/RPT-NOPE")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("No report RPT-NOPE"));
        }

        @Test
        @DisplayName("both path prefixes return the same listing")
        void bothPathPrefixesBehaveIdentically() throws Exception {
            file(e1, "One", "A");
            String local = mockMvc.perform(as(fa1, get("/reports")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            String cloud = mockMvc.perform(as(fa1, get("/api/springboot-service/reports")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
            assertThat(cloud).isEqualTo(local);
        }

        @Test
        @DisplayName("listings can be narrowed by status, location, assignee and openness")
        void listFilters() throws Exception {
            String leak = file(e1, "Leak", "Building A, Kitchen");
            String wifi = file(e1, "Wi-Fi", "Building B, Hall");
            assign(fa1, leak, "E1");

            mockMvc.perform(as(fa1, get("/reports").param("status", "UNASSIGNED")))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].reportId").value(wifi));
            mockMvc.perform(as(fa1, get("/reports").param("location", "kitchen")))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].reportId").value(leak));
            mockMvc.perform(as(fa1, get("/reports").param("completedBy", "E1")))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].reportId").value(leak));
            mockMvc.perform(as(fa1, get("/reports").param("completedOnly", "true")))
                .andExpect(jsonPath("$.length()").value(0));
            mockMvc.perform(as(fa1, get("/reports").param("openOnly", "true")))
                .andExpect(jsonPath("$.length()").value(2));
            mockMvc.perform(as(fa1, get("/reports").param("from", "2000-01-01").param("to", "2000-01-02")))
                .andExpect(jsonPath("$.length()").value(0));
            mockMvc.perform(as(fa1, get("/reports").param("from", "2000-01-01")))
                .andExpect(jsonPath("$.length()").value(2));

            mockMvc.perform(as(fa1, get("/reports").param("status", "OPEN")))
                .andExpect(status().isBadRequest());
            mockMvc.perform(as(fa1, get("/reports").param("from", "yesterday")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(startsWith("from must be an ISO date")));
        }
    }

    @Nested
    @DisplayName("the assignment request flow")
    class AssignmentRequests {

        @Test
        @DisplayName("an engineer's request waits for the admin, who approves it into an assignment")
        void requestThenApprove() throws Exception {
            String reportId = file(e2, "Leak", "Kitchen");

            mockMvc.perform(as(e1, post("/reports/" + reportId + "/assignment-requests")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.engineerId").value("E1"))
                .andExpect(jsonPath("$.engineer.email").value("E1@acme.inc"));

            // Nothing has been assigned yet; the report just carries the pending request.
            mockMvc.perform(as(e1, get("/reports/" + reportId)))
                .andExpect(jsonPath("$.status").value("UNASSIGNED"))
                .andExpect(jsonPath("$.assignees").isEmpty())
                .andExpect(jsonPath("$.pendingAssignmentRequests.length()").value(1));

            mockMvc.perform(as(e1, post("/reports/" + reportId + "/assignment-requests")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("You have already requested this report"));

            String queue = mockMvc.perform(as(fa1, get("/reports/requests")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignmentRequests.length()").value(1))
                .andExpect(jsonPath("$.assignmentRequests[0].report.reportId").value(reportId))
                .andExpect(jsonPath("$.closeRequests").isEmpty())
                .andReturn().getResponse().getContentAsString();
            String requestId = JsonPath.read(queue, "$.assignmentRequests[0].requestId");

            // The other team's admin does not see it.
            mockMvc.perform(as(fa2, get("/reports/requests")))
                .andExpect(jsonPath("$.assignmentRequests").isEmpty());

            mockMvc.perform(as(fa1, post("/reports/assignment-requests/" + requestId + "/approve")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.assignees.length()").value(1))
                .andExpect(jsonPath("$.assignees[0].assigneeId").value("E1"))
                .andExpect(jsonPath("$.assignees[0].accessLevel").value("CONTRIBUTOR"))
                .andExpect(jsonPath("$.assignees[0].assignedBy").value("FA1"))
                .andExpect(jsonPath("$.pendingAssignmentRequests").isEmpty());

            mockMvc.perform(as(fa1, post("/reports/assignment-requests/" + requestId + "/approve")))
                .andExpect(status().isConflict());
            mockMvc.perform(as(fa1, get("/reports/requests").param("status", "APPROVED")))
                .andExpect(jsonPath("$.assignmentRequests.length()").value(1));
        }

        @Test
        @DisplayName("a declined request is recorded and cannot be decided twice")
        void decline() throws Exception {
            String reportId = file(e2, "Leak", "Kitchen");
            String requestId = JsonPath.read(mockMvc.perform(
                    as(e1, post("/reports/" + reportId + "/assignment-requests")))
                .andReturn().getResponse().getContentAsString(), "$.requestId");

            mockMvc.perform(as(fa1, post("/reports/assignment-requests/" + requestId + "/decline")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DECLINED"));
            mockMvc.perform(as(fa1, post("/reports/assignment-requests/" + requestId + "/approve")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Request " + requestId + " is already DECLINED"));
            mockMvc.perform(as(fa1, get("/reports/" + reportId)))
                .andExpect(jsonPath("$.status").value("UNASSIGNED"))
                .andExpect(jsonPath("$.activity[?(@.kind == 'request')]", hasSize(2)));
        }

        @Test
        @DisplayName("only engineers on the team may request, and only unassigned reports")
        void requestRules() throws Exception {
            String reportId = file(e2, "Leak", "Kitchen");

            mockMvc.perform(as(e3, post("/reports/" + reportId + "/assignment-requests")))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(fa1, post("/reports/" + reportId + "/assignment-requests")))
                .andExpect(status().isForbidden());

            assign(fa1, reportId, "E2");
            mockMvc.perform(as(e1, post("/reports/" + reportId + "/assignment-requests")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Only unassigned reports can be requested"));

            mockMvc.perform(as(fa1, post("/reports/assignment-requests/REQ-NOPE/approve")))
                .andExpect(status().isNotFound());
            mockMvc.perform(as(e1, get("/reports/requests")))
                .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("assigning engineers directly")
    class Assigning {

        @Test
        @DisplayName("the admin sets the whole assignee set, and status follows the grant table")
        void putReplacesTheSet() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");

            mockMvc.perform(as(fa1, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[\"E1\",\"E2\",\"E2\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.assignees.length()").value(2));

            mockMvc.perform(as(fa1, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[\"E2\"]}"))
                .andExpect(jsonPath("$.assignees.length()").value(1))
                .andExpect(jsonPath("$.assignees[0].assigneeId").value("E2"));

            mockMvc.perform(as(fa1, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[]}"))
                .andExpect(jsonPath("$.status").value("UNASSIGNED"))
                .andExpect(jsonPath("$.assignees").isEmpty());

            mockMvc.perform(as(fa1, get("/reports/" + reportId)))
                .andExpect(jsonPath("$.activity[?(@.kind == 'assignment')]", hasSize(3)))
                .andExpect(jsonPath("$.activity[?(@.kind == 'status')]", hasSize(2)));
        }

        @Test
        @DisplayName("only the team's admin may assign, and only their own engineers")
        void assignmentRules() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");

            mockMvc.perform(as(e1, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[\"E1\"]}"))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(fa2, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[\"E3\"]}"))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(fa1, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[\"E3\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("E3 is not you or an engineer on your team"));
            // Another admin is not assignable; the caller themselves is (see AdminsWorkingCases).
            mockMvc.perform(as(fa1, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[\"FA2\"]}"))
                .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("moving through the lifecycle")
    class Lifecycle {

        @Test
        @DisplayName("an assignee starts and submits work; the admin approves and archives")
        void happyPath() throws Exception {
            String reportId = file(e2, "Leak", "Kitchen");
            assign(fa1, reportId, "E1");

            // E2 wrote it but is not assigned, so may not work it.
            mockMvc.perform(as(e2, moveTo(reportId, "IN_PROGRESS")))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(e1, moveTo(reportId, "IN_PROGRESS")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
            mockMvc.perform(as(e1, moveTo(reportId, "APPROVED")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only a faculty admin can move a report to APPROVED"));
            mockMvc.perform(as(e1, moveTo(reportId, "SUBMITTED")))
                .andExpect(jsonPath("$.status").value("SUBMITTED"));
            mockMvc.perform(as(fa1, moveTo(reportId, "IN_PROGRESS")))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));
            mockMvc.perform(as(e1, moveTo(reportId, "SUBMITTED")))
                .andExpect(jsonPath("$.status").value("SUBMITTED"));
            mockMvc.perform(as(fa1, moveTo(reportId, "APPROVED")))
                .andExpect(jsonPath("$.status").value("APPROVED"));
            mockMvc.perform(as(fa1, moveTo(reportId, "ARCHIVED")))
                .andExpect(jsonPath("$.status").value("ARCHIVED"));

            mockMvc.perform(as(fa1, get("/reports/" + reportId)))
                .andExpect(jsonPath("$.activity[?(@.kind == 'status')]", hasSize(7)))
                .andExpect(jsonPath("$.activity[?(@.body == 'SUBMITTED → IN_PROGRESS')]").exists());
        }

        @Test
        @DisplayName("an illegal move is a 409, an unknown status a 400")
        void illegalMoves() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");
            mockMvc.perform(as(fa1, moveTo(reportId, "APPROVED")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(startsWith("Cannot move report")));
            mockMvc.perform(as(fa1, moveTo(reportId, "DONE")))
                .andExpect(status().isBadRequest());
            mockMvc.perform(as(fa1, patch("/reports/" + reportId + "/status")
                    .contentType(MediaType.APPLICATION_JSON).content("{}")))
                .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returning a report to UNASSIGNED withdraws every grant")
        void unassignRevokesGrants() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");
            assign(fa1, reportId, "E1");

            mockMvc.perform(as(e1, moveTo(reportId, "UNASSIGNED")))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(fa1, moveTo(reportId, "UNASSIGNED")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNASSIGNED"))
                .andExpect(jsonPath("$.assignees").isEmpty());
            assertThat(assignmentRepository.findByReport(reportId)).isEmpty();
        }

        @Test
        @DisplayName("archived reports cannot be assigned")
        void archivedIsFinal() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");
            assign(fa1, reportId, "E1");
            mockMvc.perform(as(e1, moveTo(reportId, "IN_PROGRESS")));
            mockMvc.perform(as(e1, moveTo(reportId, "SUBMITTED")));
            mockMvc.perform(as(fa1, moveTo(reportId, "APPROVED")));
            mockMvc.perform(as(fa1, moveTo(reportId, "ARCHIVED")));

            mockMvc.perform(as(fa1, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[\"E2\"]}"))
                .andExpect(status().isConflict());
        }
    }

    @Nested
    @DisplayName("the close request flow")
    class CloseRequests {

        @Test
        @DisplayName("the author asks; the admin confirms and the report walks forward to ARCHIVED")
        void requestThenApprove() throws Exception {
            String reportId = file(e2, "Leak", "Kitchen");
            assign(fa1, reportId, "E1");

            mockMvc.perform(as(e1, post("/reports/" + reportId + "/close-requests")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only the report's author can request a close"));
            mockMvc.perform(as(e2, post("/reports/" + reportId + "/close-requests")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.requestedBy").value("E2"))
                .andExpect(jsonPath("$.status").value("PENDING"));
            mockMvc.perform(as(e2, post("/reports/" + reportId + "/close-requests")))
                .andExpect(status().isConflict());

            mockMvc.perform(as(e2, get("/reports/" + reportId)))
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.pendingCloseRequest.requestedBy").value("E2"));

            String queue = mockMvc.perform(as(fa1, get("/reports/requests")))
                .andExpect(jsonPath("$.closeRequests.length()").value(1))
                .andExpect(jsonPath("$.closeRequests[0].requester.employeeId").value("E2"))
                .andExpect(jsonPath("$.closeRequests[0].report.reportId").value(reportId))
                .andReturn().getResponse().getContentAsString();
            String requestId = JsonPath.read(queue, "$.closeRequests[0].requestId");

            mockMvc.perform(as(fa1, post("/reports/close-requests/" + requestId + "/approve")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVED"))
                .andExpect(jsonPath("$.pendingCloseRequest").doesNotExist());

            // ASSIGNED -> IN_PROGRESS -> SUBMITTED -> APPROVED -> ARCHIVED, plus the original
            // UNASSIGNED -> ASSIGNED: five status entries, every one a legal move.
            mockMvc.perform(as(fa1, get("/reports/" + reportId)))
                .andExpect(jsonPath("$.activity[?(@.kind == 'status')]", hasSize(5)))
                .andExpect(jsonPath("$.activity[?(@.body == 'Confirmed close request')]").exists());
        }

        @Test
        @DisplayName("an unassigned report cannot be closed; the admin must assign or decline")
        void unassignedCannotBeClosed() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");
            String requestId = JsonPath.read(mockMvc.perform(
                    as(e1, post("/reports/" + reportId + "/close-requests")))
                .andReturn().getResponse().getContentAsString(), "$.requestId");

            mockMvc.perform(as(fa1, post("/reports/close-requests/" + requestId + "/approve")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                    .value("Assign an engineer before closing, or decline the request"));
            mockMvc.perform(as(fa2, post("/reports/close-requests/" + requestId + "/decline")))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(fa1, post("/reports/close-requests/" + requestId + "/decline")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DECLINED"));
            mockMvc.perform(as(e1, get("/reports/" + reportId)))
                .andExpect(jsonPath("$.status").value("UNASSIGNED"))
                .andExpect(jsonPath("$.pendingCloseRequest").doesNotExist());
        }

        @Test
        @DisplayName("a close request id is not an assignment request id")
        void requestKindsAreSeparate() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");
            String requestId = JsonPath.read(mockMvc.perform(
                    as(e1, post("/reports/" + reportId + "/close-requests")))
                .andReturn().getResponse().getContentAsString(), "$.requestId");

            mockMvc.perform(as(fa1, post("/reports/assignment-requests/" + requestId + "/approve")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("No assignment request " + requestId));
        }
    }

    @Nested
    @DisplayName("comments and statistics")
    class CommentsAndStats {

        @Test
        @DisplayName("anyone who can see a report can comment on it, and the thread carries authors")
        void comments() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");

            mockMvc.perform(as(fa1, post("/reports/" + reportId + "/comments"))
                    .content("{\"body\":\"On it\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("comment"))
                .andExpect(jsonPath("$.body").value("On it"))
                .andExpect(jsonPath("$.author.employeeId").value("FA1"));
            mockMvc.perform(as(e1, post("/reports/" + reportId + "/comments"))
                    .content("{\"body\":\"   \"}"))
                .andExpect(status().isBadRequest());
            mockMvc.perform(as(e3, post("/reports/" + reportId + "/comments"))
                    .content("{\"body\":\"Hi\"}"))
                .andExpect(status().isForbidden());

            mockMvc.perform(as(e1, get("/reports/" + reportId)))
                .andExpect(jsonPath("$.activity.length()").value(1))
                .andExpect(jsonPath("$.activity[0].author.email").value("admin@acme.inc"));
        }

        @Test
        @DisplayName("the dashboard counts the team's reports, engineers and approvals")
        void stats() throws Exception {
            String leak = file(e1, "Leak", "Kitchen");
            file(e2, "Wi-Fi", "Hall");
            file(e3, "Other team", "Elsewhere");
            assign(fa1, leak, "E1");
            mockMvc.perform(as(e1, post("/reports/" + leak + "/close-requests")))
                .andExpect(status().isCreated());

            mockMvc.perform(as(fa1, get("/reports/stats")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.incidentsToday").value(2))
                .andExpect(jsonPath("$.openCases").value(2))
                .andExpect(jsonPath("$.unassigned").value(1))
                .andExpect(jsonPath("$.totalEngineers").value(2))
                .andExpect(jsonPath("$.availableEngineers").value(1))
                .andExpect(jsonPath("$.pendingApprovals").value(1));

            mockMvc.perform(as(fa2, get("/reports/stats")))
                .andExpect(jsonPath("$.incidentsToday").value(1))
                .andExpect(jsonPath("$.totalEngineers").value(1))
                .andExpect(jsonPath("$.pendingApprovals").value(0));

            mockMvc.perform(as(e1, get("/reports/stats")))
                .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("faculty admins working cases")
    class AdminsWorkingCases {

        @Test
        @DisplayName("an admin files a report, takes it, and works it through to SUBMITTED")
        void adminTakesAndWorksACase() throws Exception {
            String reportId = file(fa1, "Broken lock", "Store room");

            mockMvc.perform(as(fa1, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[\"FA1\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.assignees[0].assigneeId").value("FA1"))
                .andExpect(jsonPath("$.assignees[0].assignedBy").value("FA1"))
                .andExpect(jsonPath("$.assignees[0].employee.role").value("FACULTY_ADMIN"));

            mockMvc.perform(as(fa1, moveTo(reportId, "IN_PROGRESS")))
                .andExpect(status().isOk());
            mockMvc.perform(as(fa1, moveTo(reportId, "SUBMITTED")))
                .andExpect(jsonPath("$.status").value("SUBMITTED"));
        }

        @Test
        @DisplayName("an admin can work alongside their engineers, but not put another admin on")
        void adminJoinsTheirEngineers() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");

            assign(fa1, reportId, "FA1", "E1");
            mockMvc.perform(as(fa1, get("/reports/" + reportId)))
                .andExpect(jsonPath("$.assignees.length()").value(2));

            mockMvc.perform(as(fa1, put("/reports/" + reportId + "/assignees"))
                    .content("{\"engineerIds\":[\"FA2\"]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("FA2 is not you or an engineer on your team"));
        }

        @Test
        @DisplayName("an admin takes cases directly, so requesting one is refused")
        void adminsDoNotRequest() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");
            mockMvc.perform(as(fa1, post("/reports/" + reportId + "/assignment-requests")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value(startsWith("Faculty admins take reports directly")));
        }

        @Test
        @DisplayName("an admin on a case does not change the engineer availability numbers")
        void statsCountEngineersOnly() throws Exception {
            String reportId = file(e1, "Leak", "Kitchen");
            assign(fa1, reportId, "FA1");

            mockMvc.perform(as(fa1, get("/reports/stats")))
                .andExpect(jsonPath("$.totalEngineers").value(2))
                .andExpect(jsonPath("$.availableEngineers").value(2));
        }
    }

    @Nested
    @DisplayName("plain employees")
    class PlainEmployees {

        @Test
        @DisplayName("anyone can register without a token, and is signed in as an EMPLOYEE on no team")
        void registerSignsIn() throws Exception {
            String body = mockMvc.perform(post("/api/springboot-service/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\" S1@acme.inc \",\"password\":\"password\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.expiresAt").isNotEmpty())
                .andExpect(jsonPath("$.user.employeeId").value(startsWith("EMP-")))
                .andExpect(jsonPath("$.user.email").value("S1@acme.inc"))
                .andExpect(jsonPath("$.user.role").value("EMPLOYEE"))
                .andExpect(jsonPath("$.user.facultyAdminId").doesNotExist())
                .andExpect(jsonPath("$.user.password").doesNotExist())
                .andReturn().getResponse().getContentAsString();

            String s1 = JsonPath.read(body, "$.token");
            mockMvc.perform(as(s1, get("/auth/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("EMPLOYEE"));
            mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"s1@acme.inc\",\"password\":\"password\"}"))
                .andExpect(status().isOk());
            mockMvc.perform(as(e1, get("/employees")))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].email").value("S1@acme.inc"));
        }

        @Test
        @DisplayName("an email held by any kind of account, in any case, cannot register again")
        void registerNeedsAnUnusedEmail() throws Exception {
            mockMvc.perform(register("e1@ACME.INC", "password"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(startsWith("An account with email")));
            mockMvc.perform(register("admin@acme.inc", "password"))
                .andExpect(status().isConflict());
            registerEmployee("S1");
            mockMvc.perform(register("s1@acme.inc", "password"))
                .andExpect(status().isConflict());

            // And the other way round: an admin cannot give an engineer a registered employee's email.
            mockMvc.perform(as(fa1, post("/engineers"))
                    .content("{\"email\":\"S1@acme.inc\",\"password\":\"pw\",\"employeeId\":\"X\"}"))
                .andExpect(status().isConflict());
        }

        @Test
        @DisplayName("registration needs a real-looking email and an 8-character password")
        void registerValidates() throws Exception {
            mockMvc.perform(register("not-an-email", "password"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("email must be a valid email address"));
            mockMvc.perform(register("new@acme.inc", "short"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("password must be at least 8 characters"));
        }

        @Test
        @DisplayName("registration only accepts an @acme.inc address, matched exactly")
        void registerRejectsOtherDomains() throws Exception {
            for (String email : new String[] {
                "pat@acme.com", "pat@example.com", "pat@acme.inc.example.com", "pat@sub.acme.inc"}) {
                mockMvc.perform(register(email, "password"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("email must be an @acme.inc address"));
            }
            assertThat(employeeRepository.findAll()).isEmpty();

            mockMvc.perform(register(" Pat@Acme.Inc ", "password"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.email").value("Pat@Acme.Inc"));
        }

        @Test
        @DisplayName("their report carries type and priority, and every admin and engineer sees it")
        void reportsAreShared() throws Exception {
            String s1 = registerEmployee("S1");
            String s2 = registerEmployee("S2");

            String body = mockMvc.perform(as(s1, post("/reports"))
                    .content("{\"title\":\"Broken door\",\"location\":\"Lobby\","
                        + "\"incidentType\":\"facilities\",\"priority\":\"HIGH\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.incidentType").value("FACILITIES"))
                .andExpect(jsonPath("$.priority").value("HIGH"))
                .andExpect(jsonPath("$.author.role").value("EMPLOYEE"))
                .andReturn().getResponse().getContentAsString();
            String reportId = JsonPath.read(body, "$.reportId");

            for (String token : new String[] {s1, fa1, fa2, e1, e3}) {
                mockMvc.perform(as(token, get("/reports")))
                    .andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].priority").value("HIGH"));
            }
            mockMvc.perform(as(s2, get("/reports")))
                .andExpect(jsonPath("$.length()").value(0));
            mockMvc.perform(as(s2, get("/reports/" + reportId)))
                .andExpect(status().isForbidden());

            // Picked up by an engineer on another team, through the usual request and approval.
            String requestBody = mockMvc.perform(
                    as(e3, post("/reports/" + reportId + "/assignment-requests")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
            String requestId = JsonPath.read(requestBody, "$.requestId");
            mockMvc.perform(as(fa2, post("/reports/assignment-requests/" + requestId + "/approve")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"));
        }

        @Test
        @DisplayName("they may comment on and ask to close their own report, and nothing more")
        void authorRightsOnly() throws Exception {
            String s1 = registerEmployee("S1");
            String mine = file(s1, "Spill", "Lab");
            String teams = file(e1, "Leak", "Kitchen");

            mockMvc.perform(as(s1, get("/reports/" + teams)))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(s1, post("/reports/" + mine + "/assignment-requests")))
                .andExpect(status().isForbidden());
            assign(fa1, mine, "E1");
            mockMvc.perform(as(s1, moveTo(mine, "IN_PROGRESS")))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(s1, post("/reports/" + mine + "/comments"))
                    .content("{\"body\":\"Still wet\"}"))
                .andExpect(status().isCreated());
            mockMvc.perform(as(s1, post("/reports/" + mine + "/close-requests")))
                .andExpect(status().isCreated());
            mockMvc.perform(as(s1, delete("/employees/" + "EMP-X")))
                .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("an unknown incident type or priority is a 400; leaving them out is fine")
        void classificationIsValidated() throws Exception {
            mockMvc.perform(as(e1, post("/reports"))
                    .content("{\"title\":\"t\",\"location\":\"l\",\"priority\":\"URGENT\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(startsWith("Unknown priority 'URGENT'")));
            mockMvc.perform(as(e1, post("/reports"))
                    .content("{\"title\":\"t\",\"location\":\"l\",\"incidentType\":\"FIRE\"}"))
                .andExpect(status().isBadRequest());
            mockMvc.perform(as(e1, post("/reports")).content("{\"title\":\"t\",\"location\":\"l\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.incidentType").doesNotExist())
                .andExpect(jsonPath("$.priority").doesNotExist());
        }
    }

    @Nested
    @DisplayName("promoting a plain employee to engineer")
    class Promoting {

        /** A registered plain employee: their id and the token from signing up. */
        private String employeeId;
        private String employeeToken;

        @BeforeEach
        void registerAnEmployee() throws Exception {
            String body = mockMvc.perform(register("S1@acme.inc", "s1-password"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
            employeeId = JsonPath.read(body, "$.user.employeeId");
            employeeToken = JsonPath.read(body, "$.token");
        }

        @Test
        @DisplayName("puts them on the admin's team, keeping their password and their session")
        void promotesInPlace() throws Exception {
            mockMvc.perform(as(fa1, post("/employees/" + employeeId + "/promote")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeId").value(employeeId))
                .andExpect(jsonPath("$.email").value("S1@acme.inc"))
                .andExpect(jsonPath("$.facultyAdminId").value("FA1"))
                .andExpect(jsonPath("$.password").doesNotExist());

            // The same token still works, and the role applies from the next request.
            mockMvc.perform(as(employeeToken, get("/auth/me")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ENGINEER"))
                .andExpect(jsonPath("$.facultyAdminId").value("FA1"));
            mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"S1@acme.inc\",\"password\":\"s1-password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.role").value("ENGINEER"));

            mockMvc.perform(as(fa1, get("/faculty-admins/FA1/engineers")))
                .andExpect(jsonPath("$[*].employeeId", hasItem(employeeId)));
            mockMvc.perform(as(fa1, get("/employees")))
                .andExpect(jsonPath("$.length()").value(0));
        }

        @Test
        @DisplayName("keeps the reports they filed, which now belong to the admin's team")
        void reportsFollowThem() throws Exception {
            String body = mockMvc.perform(as(employeeToken, post("/reports"))
                    .content("{\"title\":\"Broken door\",\"location\":\"Lobby\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
            String reportId = JsonPath.read(body, "$.reportId");
            // Filed by somebody on no team, so every admin sees it.
            mockMvc.perform(as(fa2, get("/reports/" + reportId))).andExpect(status().isOk());

            mockMvc.perform(as(fa1, post("/employees/" + employeeId + "/promote")))
                .andExpect(status().isOk());

            mockMvc.perform(as(employeeToken, get("/reports/" + reportId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authorId").value(employeeId))
                .andExpect(jsonPath("$.author.role").value("ENGINEER"));
            mockMvc.perform(as(e2, get("/reports/" + reportId))).andExpect(status().isOk());
            mockMvc.perform(as(fa2, get("/reports/" + reportId))).andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("works on the cloud path prefix too")
        void cloudPrefix() throws Exception {
            mockMvc.perform(as(fa2, post("/api/springboot-service/employees/" + employeeId + "/promote")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.facultyAdminId").value("FA2"));
        }

        @Test
        @DisplayName("only a faculty admin may promote")
        void onlyAdminsPromote() throws Exception {
            for (String token : new String[] {e1, employeeToken}) {
                mockMvc.perform(as(token, post("/employees/" + employeeId + "/promote")))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.message").value(startsWith("Only a faculty admin")));
            }
            mockMvc.perform(as(employeeToken, get("/auth/me")))
                .andExpect(jsonPath("$.role").value("EMPLOYEE"));
        }

        @Test
        @DisplayName("an unknown id is 404, and an engineer's or admin's id is 409")
        void onlyPlainEmployees() throws Exception {
            mockMvc.perform(as(fa1, post("/employees/EMP-NOBODY/promote")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("No employee EMP-NOBODY"));
            mockMvc.perform(as(fa1, post("/employees/E3/promote")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("E3 is already an engineer"));
            mockMvc.perform(as(fa1, post("/employees/FA2/promote")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("FA2 is a faculty admin"));
            // Nothing was demoted or moved along the way.
            mockMvc.perform(as(fa2, get("/faculty-admins/FA2/engineers")))
                .andExpect(jsonPath("$[*].employeeId", hasItem("E3")));
        }
    }

    // ---------------------------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------------------------

    /**
     * Adds the bearer token and JSON content type to a request.
     */
    private static MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder request) {
        return request
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON);
    }

    private static MockHttpServletRequestBuilder moveTo(String reportId, String next) {
        return patch("/reports/" + reportId + "/status")
            .content("{\"status\":\"" + next + "\"}");
    }

    /** Files a report as the token holder and returns its id. */
    private String file(String token, String title, String location) throws Exception {
        String body = mockMvc.perform(as(token, post("/reports"))
                .content(String.format("{\"title\":\"%s\",\"location\":\"%s\"}", title, location)))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.reportId");
    }

    /** Puts exactly the given engineers on a report, as the token holder. */
    private void assign(String token, String reportId, String... engineerIds) throws Exception {
        String ids = String.join("\",\"", engineerIds);
        mockMvc.perform(as(token, put("/reports/" + reportId + "/assignees"))
                .content("{\"engineerIds\":[\"" + ids + "\"]}"))
            .andExpect(status().isOk());
    }

    private String login(String employeeId) throws Exception {
        String body = mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(String.format(
                    "{\"email\":\"%s\",\"password\":\"pw\"}", emailOf(employeeId))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    /**
     * The email a seeded account has: FA1, the bootstrap admin, is the default admin, which is what
     * lets it create FA2; everyone else is {@code <id>@acme.inc}.
     */
    private static String emailOf(String employeeId) {
        return "FA1".equals(employeeId) ? "admin@acme.inc" : employeeId + "@acme.inc";
    }

    /**
     * Creates a faculty admin through the API, as the token holder or anonymously for the first.
     */
    private void createAdmin(String employeeId, String token) throws Exception {
        MockHttpServletRequestBuilder request = post("/faculty-admins")
            .contentType(MediaType.APPLICATION_JSON)
            .content(String.format(
                "{\"email\":\"%s\",\"password\":\"pw\",\"employeeId\":\"%s\"}",
                emailOf(employeeId), employeeId));
        if (token != null) {
            request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        }
        mockMvc.perform(request).andExpect(status().isCreated());
    }

    /** A registration request, sent without a token. */
    private static MockHttpServletRequestBuilder register(String email, String password) {
        return post("/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(String.format("{\"email\":\"%s\",\"password\":\"%s\"}", email, password));
    }

    /**
     * Registers a plain employee as {@code <name>@acme.inc} and returns their token. The id is
     * generated, so the name only picks the email.
     */
    private String registerEmployee(String name) throws Exception {
        String body = mockMvc.perform(register(name + "@acme.inc", "password"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    /** Creates an engineer under an admin, as that admin. */
    private void createEngineer(String employeeId, String facultyAdminId, String token)
        throws Exception {
        mockMvc.perform(as(token, post("/engineers"))
                .content(String.format(
                    "{\"email\":\"%s@acme.inc\",\"password\":\"pw\",\"employeeId\":\"%s\","
                        + "\"facultyAdminId\":\"%s\"}",
                    employeeId, employeeId, facultyAdminId)))
            .andExpect(status().isCreated());
    }
}
