package com.example.repos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Exercises the service against a real PostgreSQL server.
 *
 * Everything else in the suite runs on the in-memory repositories, which is fast and proves the HTTP
 * surface behaves. It cannot prove that a row lands in a table, that a foreign key is written, or
 * that a graph rebuilt from columns matches the one that was stored. That is what these check.
 *
 * Note the absence of the test profile: without it the JDBC repositories are the ones wired in, and
 * schema.sql runs for real. The tests skip rather than fail when no server is listening, so the build
 * still passes on a machine that has not set PostgreSQL up.
 */
@SpringBootTest(properties = {
    "spring.autoconfigure.exclude="
        + "org.springframework.cloud.function.serverless.web.ServerlessAutoConfiguration",
    "spring.sql.init.mode=always"
})
@AutoConfigureMockMvc
@EnabledIf("postgresIsReachable")
class JdbcPersistenceTest {

    /** Performs the HTTP requests. */
    @Autowired
    private MockMvc mockMvc;

    /** Used to read raw columns, so assertions check what was stored rather than what was returned. */
    @Autowired
    private JdbcClient jdbcClient;

    /** Bearer tokens obtained so far in the current test, by employee id. */
    private final Map<String, String> tokens = new HashMap<>();

    /**
     * Reports whether a PostgreSQL server is accepting connections locally.
     *
     * Evaluated by JUnit before the Spring context is built, so an unreachable database skips these
     * tests instead of failing them with a context load error.
     *
     * @return true when something is listening on the local PostgreSQL port
     */
    static boolean postgresIsReachable() {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("localhost", 5432), 500);
            return true;
        } catch (IOException unreachable) {
            return false;
        }
    }

    @BeforeEach
    void emptyTheTable() {
        tokens.clear();
        // All together: Postgres refuses to truncate a table a foreign key points at, and every
        // report table points at employee or report. Naming them in one statement satisfies that.
        jdbcClient.sql("TRUNCATE TABLE employee, report, report_assignment,"
            + " report_activity, report_request").update();
    }

    @Test
    @DisplayName("a created faculty admin becomes a row, with a hashed password")
    void creatingAnAdminWritesARow() throws Exception {
        createAdmin("FA1");

        Optional<String> role = jdbcClient
            .sql("SELECT role FROM employee WHERE employee_id = 'FA1'")
            .query(String.class)
            .optional();
        String storedHash = jdbcClient
            .sql("SELECT password_hash FROM employee WHERE employee_id = 'FA1'")
            .query(String.class)
            .single();

        assertThat(role).contains("FACULTY_ADMIN");
        assertThat(storedHash).isNotEqualTo("pw").startsWith("$2a$");
    }

    @Test
    @DisplayName("creating an engineer under an admin writes the foreign key")
    void creatingAnEngineerWritesTheForeignKey() throws Exception {
        createAdmin("FA1");
        createEngineer("E1", "FA1");

        assertThat(facultyAdminIdOf("E1")).contains("FA1");
    }

    @Test
    @DisplayName("changing a password rewrites only the digest: the engineer keeps their admin")
    void changingAPasswordRewritesTheDigest() throws Exception {
        createAdmin("FA1");
        createEngineer("E1", "FA1");
        String before = passwordHashOf("E1");

        mockMvc.perform(as("E1", put("/auth/password"))
                .content("{\"currentPassword\":\"pw\",\"newPassword\":\"brand-new-pw\"}"))
            .andExpect(status().isOk());

        assertThat(passwordHashOf("E1")).isNotEqualTo(before).startsWith("$2a$");
        assertThat(facultyAdminIdOf("E1")).contains("FA1");
        assertThat(jdbcClient.sql("SELECT role FROM employee WHERE employee_id = 'E1'")
            .query(String.class).single()).isEqualTo("ENGINEER");

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"E1@example.com\",\"password\":\"brand-new-pw\"}"))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("a registered employee is an EMPLOYEE row that can sign in and file a classified report")
    void registeringWritesAnEmployeeRow() throws Exception {
        String body = mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"s1@example.com\",\"password\":\"password\"}"))
            .andExpect(status().isCreated())
            .andReturn().getResponse().getContentAsString();
        String employeeId = com.jayway.jsonpath.JsonPath.read(body, "$.user.employeeId");
        String token = com.jayway.jsonpath.JsonPath.read(body, "$.token");

        assertThat(jdbcClient.sql("SELECT role FROM employee WHERE employee_id = :id")
            .param("id", employeeId).query(String.class).single()).isEqualTo("EMPLOYEE");
        assertThat(facultyAdminIdOf(employeeId)).isEmpty();

        mockMvc.perform(post("/reports")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Leak\",\"location\":\"Lab\","
                    + "\"incidentType\":\"SAFETY\",\"priority\":\"critical\"}"))
            .andExpect(status().isCreated());
        assertThat(jdbcClient.sql("SELECT incident_type || '/' || priority FROM report")
            .query(String.class).single()).isEqualTo("SAFETY/CRITICAL");
        mockMvc.perform(get("/reports").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
            .andExpect(jsonPath("$[0].incidentType").value("SAFETY"))
            .andExpect(jsonPath("$[0].priority").value("CRITICAL"));
    }

    @Test
    @DisplayName("an admin read back from the database carries its engineers")
    void readingAnAdminRebuildsItsEngineers() throws Exception {
        createAdmin("FA1");
        createEngineer("E1", "FA1");
        createEngineer("E2", "FA1");

        mockMvc.perform(as("FA1", get("/faculty-admins/FA1")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.managedEngineers.length()").value(2));

        // The back-reference has to survive the round trip too, not just the forward one.
        mockMvc.perform(as("FA1", get("/engineers/E1")))
            .andExpect(jsonPath("$.facultyAdminId").value("FA1"));
    }

    @Test
    @DisplayName("assigning an engineer twice does not duplicate them")
    void assigningTwiceIsIdempotent() throws Exception {
        createAdmin("FA1");
        createEngineer("E1", "FA1");

        mockMvc.perform(as("FA1", put("/faculty-admins/FA1/engineers/E1")))
            .andExpect(status().isOk())
            // Each read builds new objects, so this is only 1 because employees compare by id.
            .andExpect(jsonPath("$.managedEngineers.length()").value(1));
    }

    @Test
    @DisplayName("moving an engineer to another admin rewrites the foreign key")
    void reassigningRewritesTheForeignKey() throws Exception {
        createAdmin("FA1");
        createAdmin("FA2");
        createEngineer("E1", "FA1");

        mockMvc.perform(as("FA2", put("/faculty-admins/FA2/engineers/E1")))
            .andExpect(status().isOk());

        assertThat(facultyAdminIdOf("E1")).contains("FA2");
        mockMvc.perform(as("FA1", get("/faculty-admins/FA1/engineers")))
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("unassigning clears the foreign key in the database")
    void unassigningClearsTheForeignKey() throws Exception {
        createAdmin("FA1");
        createEngineer("E1", "FA1");

        mockMvc.perform(as("FA1", delete("/faculty-admins/FA1/engineers/E1")))
            .andExpect(status().isNoContent());

        assertThat(facultyAdminIdOf("E1")).isEmpty();
    }

    @Test
    @DisplayName("deleting an engineer removes the row")
    void deletingAnEngineerRemovesTheRow() throws Exception {
        createAdmin("FA1");
        createEngineer("E1", "FA1");

        mockMvc.perform(as("FA1", delete("/engineers/E1")))
            .andExpect(status().isNoContent());

        assertThat(countOf("E1")).isZero();
        mockMvc.perform(as("FA1", get("/faculty-admins/FA1/engineers")))
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("deleting an admin leaves their engineers behind, unassigned")
    void deletingAnAdminOrphansItsEngineersSafely() throws Exception {
        createAdmin("FA1");
        createEngineer("E1", "FA1");

        jdbcClient.sql("DELETE FROM employee WHERE employee_id = 'FA1'").update();

        // ON DELETE SET NULL, so the engineer survives rather than vanishing or dangling.
        assertThat(countOf("E1")).isEqualTo(1);
        assertThat(facultyAdminIdOf("E1")).isEmpty();
        // FA1 is gone, so E1 reads their own record.
        mockMvc.perform(as("E1", get("/engineers/E1")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.facultyAdminId").doesNotExist());
    }

    @Test
    @DisplayName("data written through the API is visible to a query that knows nothing about it")
    void writesArePlainRowsAnyoneCanRead() throws Exception {
        createAdmin("FA1");
        createEngineer("E1", "FA1");

        // Deliberately not going through the repositories: if this sees the data, so would psql
        // after a restart, which is the whole point of the exercise.
        Long total = jdbcClient.sql("SELECT count(*) FROM employee").query(Long.class).single();

        assertThat(total).isEqualTo(2);
    }

    /**
     * Returns the managing admin id stored for an engineer.
     *
     * @param employeeId the engineer's id
     * @return the stored faculty_admin_id, empty when the column is null
     */
    private Optional<String> facultyAdminIdOf(String employeeId) {
        return jdbcClient.sql("SELECT faculty_admin_id FROM employee WHERE employee_id = :id")
            .param("id", employeeId)
            .query(String.class)
            .optional();
    }

    /**
     * Reads the stored password digest straight from the table.
     *
     * @param employeeId the employee to look up
     * @return their password_hash column
     */
    private String passwordHashOf(String employeeId) {
        return jdbcClient.sql("SELECT password_hash FROM employee WHERE employee_id = :id")
            .param("id", employeeId)
            .query(String.class)
            .single();
    }

    /**
     * Counts rows with the given employee id.
     *
     * @param employeeId the id to count
     * @return the number of matching rows, zero or one
     */
    private long countOf(String employeeId) {
        return jdbcClient.sql("SELECT count(*) FROM employee WHERE employee_id = :id")
            .param("id", employeeId)
            .query(Long.class)
            .single();
    }

    /**
     * Creates a faculty admin through the API.
     *
     * @param employeeId the id to give the admin
     * @throws Exception if the request fails
     */
    private void createAdmin(String employeeId) throws Exception {
        MockHttpServletRequestBuilder request = post("/faculty-admins")
            .contentType(MediaType.APPLICATION_JSON)
            .content(String.format(
                "{\"email\":\"%s@example.com\",\"password\":\"pw\",\"employeeId\":\"%s\"}",
                employeeId, employeeId));
        // Only the first admin is created anonymously; each one after is created by the first.
        Optional<String> existing = jdbcClient
            .sql("SELECT employee_id FROM employee WHERE role = 'FACULTY_ADMIN' LIMIT 1")
            .query(String.class)
            .optional();
        if (existing.isPresent()) {
            request.header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(existing.get()));
        }
        mockMvc.perform(request).andExpect(status().isCreated());
    }

    /**
     * Creates an engineer through the API.
     *
     * @param employeeId the id to give the engineer
     * @param facultyAdminId the managing admin's id, or null to leave them unassigned
     * @throws Exception if the request fails
     */
    private void createEngineer(String employeeId, String facultyAdminId) throws Exception {
        String admin = facultyAdminId == null
            ? ""
            : String.format(",\"facultyAdminId\":\"%s\"", facultyAdminId);
        // As the managing admin, or as any admin when the engineer is to be left unmanaged.
        String creator = facultyAdminId != null ? facultyAdminId : jdbcClient
            .sql("SELECT employee_id FROM employee WHERE role = 'FACULTY_ADMIN' LIMIT 1")
            .query(String.class)
            .single();
        mockMvc.perform(as(creator, post("/engineers"))
                .content(String.format(
                    "{\"email\":\"%s@example.com\",\"password\":\"pw\",\"employeeId\":\"%s\"%s}",
                    employeeId, employeeId, admin)))
            .andExpect(status().isCreated());
    }

    /**
     * Adds the bearer token for an employee (signing them in the first time) and the JSON type.
     *
     * @param employeeId whose token to send
     * @param request the request to decorate
     * @return the same request, with the headers set
     * @throws Exception if signing in fails
     */
    private MockHttpServletRequestBuilder as(String employeeId, MockHttpServletRequestBuilder request)
        throws Exception {
        return request
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + tokenFor(employeeId))
            .contentType(MediaType.APPLICATION_JSON);
    }

    /**
     * Signs an employee in once per test and remembers the token.
     *
     * @param employeeId the employee; every seeded account uses the password "pw"
     * @return their bearer token
     * @throws Exception if signing in fails
     */
    private String tokenFor(String employeeId) throws Exception {
        String cached = tokens.get(employeeId);
        if (cached != null) {
            return cached;
        }
        String body = mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(String.format(
                    "{\"email\":\"%s@example.com\",\"password\":\"pw\"}", employeeId)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String token = com.jayway.jsonpath.JsonPath.read(body, "$.token");
        tokens.put(employeeId, token);
        return token;
    }
}
