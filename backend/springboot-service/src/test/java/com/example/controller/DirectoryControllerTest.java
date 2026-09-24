package com.example.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.repos.EmployeeRepository;
import com.example.repos.EngineerRepository;
import com.example.repos.FacultyAdminRepository;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Exercises the HTTP surface against the real repositories and controllers.
 *
 * Uses the full application context rather than a web slice, so the wiring under test is the wiring
 * that ships. The repositories are singletons, hence the reset before each test: without it, whatever
 * ran first decides what the others see.
 *
 * Every test starts with one faculty admin, FA1, created through the anonymous bootstrap call and
 * signed in. Everything else is created through the API as FA1, so the authorization rules are
 * exercised on every request rather than bypassed.
 *
 * ServerlessAutoConfiguration is excluded because it unconditionally contributes a
 * ServletWebServerFactory. That is exactly right inside Lambda, where it is how the application runs
 * without a real web server, and exactly wrong here, where MockMvc supplies its own servlet
 * environment and the two arrangements cannot both hold. Excluding it is a statement about the test
 * harness, not about the deployed application — so the shaded jar still has to be booted separately
 * to prove the real path works.
 *
 * SQL initialisation is turned off for the same kind of reason. These tests exercise the HTTP surface
 * against in-memory repositories and never read a row, so running schema.sql would only force every
 * one of them to require a live PostgreSQL server. The script is covered by the integration tests
 * instead, which connect on purpose.
 */
@SpringBootTest(properties = {
    "spring.autoconfigure.exclude="
        + "org.springframework.cloud.function.serverless.web.ServerlessAutoConfiguration",
    "spring.sql.init.mode=never"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class DirectoryControllerTest {

    /** Performs the requests. */
    @Autowired
    private MockMvc mockMvc;

    /** Reset between tests so state does not leak across methods. */
    @Autowired
    private EmployeeRepository employeeRepository;

    /** Reset between tests so state does not leak across methods. */
    @Autowired
    private EngineerRepository engineerRepository;

    /** Reset between tests so state does not leak across methods. */
    @Autowired
    private FacultyAdminRepository facultyAdminRepository;

    /** The same encoder the controllers use, for verifying digests round-trip. */
    @Autowired
    private PasswordEncoder passwordEncoder;

    /** FA1's bearer token. */
    private String fa1;

    @BeforeEach
    void clearRepositoriesAndBootstrap() throws Exception {
        employeeRepository.deleteAll();
        engineerRepository.deleteAll();
        facultyAdminRepository.deleteAll();
        createAdmin("FA1", null);
        fa1 = login("FA1");
    }

    @Test
    @DisplayName("creating a faculty admin returns 201 and never echoes the password")
    void createFacultyAdminNeverLeaksThePassword() throws Exception {
        mockMvc.perform(as(fa1, post("/faculty-admins")).content(adminBody("FA2")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.employeeId").value("FA2"))
            .andExpect(jsonPath("$.email").value("FA2@example.com"))
            .andExpect(jsonPath("$.managedEngineers").isEmpty())
            .andExpect(jsonPath("$.password").doesNotExist());

        mockMvc.perform(as(fa1, get("/faculty-admins/FA2")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    @DisplayName("the stored credential is a hash, not the password that was sent")
    void createdStaffHaveHashedPasswords() throws Exception {
        createEngineer("E1", "FA1", fa1);

        String adminCredential = facultyAdminRepository.findById("FA1").orElseThrow().getPassword();
        String engineerCredential = engineerRepository.findById("E1").orElseThrow().getPassword();

        // $2a$ marks a BCrypt digest; the cost factor and salt follow it.
        assertThat(adminCredential).isNotEqualTo("pw").startsWith("$2a$");
        assertThat(engineerCredential).isNotEqualTo("pw").startsWith("$2a$");

        // Salted per credential, so identical passwords must not produce identical digests.
        assertThat(adminCredential).isNotEqualTo(engineerCredential);

        // And the digest still verifies against the original password.
        assertThat(passwordEncoder.matches("pw", adminCredential)).isTrue();
        assertThat(passwordEncoder.matches("wrong", adminCredential)).isFalse();
    }

    @Test
    @DisplayName("an engineer created under an admin shows up in that admin's list")
    void createEngineerUnderAdmin() throws Exception {
        mockMvc.perform(as(fa1, post("/engineers")).content(engineerBody("E1", "FA1")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.employeeId").value("E1"))
            .andExpect(jsonPath("$.facultyAdminId").value("FA1"))
            .andExpect(jsonPath("$.password").doesNotExist());

        mockMvc.perform(as(fa1, get("/faculty-admins/FA1/engineers")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].employeeId").value("E1"));
    }

    @Test
    @DisplayName("both the local and the CloudFront path return the same thing")
    void bothPathPrefixesBehaveIdentically() throws Exception {
        createEngineer("E1", "FA1", fa1);

        String local = mockMvc.perform(as(fa1, get("/faculty-admins/FA1/engineers")))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        String cloud = mockMvc.perform(
                as(fa1, get("/api/springboot-service/faculty-admins/FA1/engineers")))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        assertThat(cloud).isEqualTo(local);
    }

    @Test
    @DisplayName("the health endpoint answers on both the root and the prefixed path, without a token")
    void healthAnswersOnBothPaths() throws Exception {
        mockMvc.perform(get("/"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"));

        mockMvc.perform(get("/api/springboot-service"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    @DisplayName("fetching an admin with engineers does not recurse forever")
    void fetchingAnAdminSerializesWithoutRecursing() throws Exception {
        createEngineer("E1", "FA1", fa1);

        mockMvc.perform(as(fa1, get("/faculty-admins/FA1")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.managedEngineers[0].facultyAdminId").value("FA1"))
            .andExpect(jsonPath("$.managedEngineers[0].managedEngineers").doesNotExist());
    }

    @Test
    @DisplayName("assigning an engineer to a second admin moves them")
    void assigningToASecondAdminMovesTheEngineer() throws Exception {
        createAdmin("FA2", fa1);
        String fa2 = login("FA2");
        createEngineer("E1", "FA1", fa1);

        mockMvc.perform(as(fa2, put("/faculty-admins/FA2/engineers/E1")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.managedEngineers.length()").value(1));

        mockMvc.perform(as(fa1, get("/faculty-admins/FA1/engineers")))
            .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(as(fa1, get("/engineers/E1")))
            .andExpect(jsonPath("$.facultyAdminId").value("FA2"));
    }

    @Test
    @DisplayName("unassigning returns 204 and detaches the engineer")
    void unassigningDetaches() throws Exception {
        createEngineer("E1", "FA1", fa1);

        mockMvc.perform(as(fa1, delete("/faculty-admins/FA1/engineers/E1")))
            .andExpect(status().isNoContent());

        // facultyAdminId is omitted rather than null, per the Jackson inclusion setting
        mockMvc.perform(as(fa1, get("/engineers/E1")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.facultyAdminId").doesNotExist());
    }

    @Test
    @DisplayName("unassigning an engineer the admin does not manage is a conflict, not a 404")
    void unassigningAnUnmanagedEngineerConflicts() throws Exception {
        createEngineer("E1", null, fa1);

        mockMvc.perform(as(fa1, delete("/faculty-admins/FA1/engineers/E1")))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    @DisplayName("deleting an engineer removes them from their admin's list")
    void deletingAnEngineerLeavesNoGhost() throws Exception {
        createEngineer("E1", "FA1", fa1);

        mockMvc.perform(as(fa1, delete("/engineers/E1")))
            .andExpect(status().isNoContent());

        mockMvc.perform(as(fa1, get("/faculty-admins/FA1/engineers")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("filtering engineers by admin returns only theirs")
    void listingEngineersCanBeFilteredByAdmin() throws Exception {
        createAdmin("FA2", fa1);
        String fa2 = login("FA2");
        createEngineer("E1", "FA1", fa1);
        createEngineer("E2", "FA2", fa2);
        createEngineer("E3", null, fa1);

        mockMvc.perform(as(fa1, get("/engineers")))
            .andExpect(jsonPath("$.length()").value(3));
        mockMvc.perform(as(fa1, get("/engineers")).param("facultyAdminId", "FA1"))
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].employeeId").value("E1"));
    }

    @Test
    @DisplayName("an unknown admin is a 404 with an error body")
    void unknownAdminIsNotFound() throws Exception {
        mockMvc.perform(as(fa1, get("/faculty-admins/nope")))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.status").value(404))
            .andExpect(jsonPath("$.message").value("No faculty admin nope"));
    }

    @Test
    @DisplayName("a blank required field is a 400")
    void blankFieldIsABadRequest() throws Exception {
        mockMvc.perform(as(fa1, post("/faculty-admins"))
                .content("{\"email\":\"\",\"password\":\"pw\",\"employeeId\":\"FA2\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("email must not be blank"));
    }

    @Test
    @DisplayName("reusing an employee id is a conflict, across roles too")
    void duplicateEmployeeIdConflicts() throws Exception {
        mockMvc.perform(as(fa1, post("/faculty-admins")).content(adminBody("FA1")))
            .andExpect(status().isConflict());

        mockMvc.perform(as(fa1, post("/engineers")).content(engineerBody("FA1", null)))
            .andExpect(status().isConflict());
    }

    @Nested
    @DisplayName("who may do what")
    class WhoMayDoWhat {

        @Test
        @DisplayName("only the very first faculty admin can be created without a token")
        void bootstrapClosesAfterTheFirstAdmin() throws Exception {
            mockMvc.perform(post("/faculty-admins")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(adminBody("FA2")))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.WWW_AUTHENTICATE, "Bearer"))
                .andExpect(jsonPath("$.message").value("Sign in to continue"));

            mockMvc.perform(as(fa1, post("/faculty-admins")).content(adminBody("FA2")))
                .andExpect(status().isCreated());

            assertThat(facultyAdminRepository.findAll()).hasSize(2);
        }

        @Test
        @DisplayName("a bad token on the bootstrap endpoint is still a 401, not anonymous access")
        void bootstrapDoesNotIgnoreABadToken() throws Exception {
            facultyAdminRepository.deleteAll();

            mockMvc.perform(post("/faculty-admins")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer not.a.token")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(adminBody("FA2")))
                .andExpect(status().isUnauthorized());

            assertThat(facultyAdminRepository.findAll()).isEmpty();
        }

        @Test
        @DisplayName("every directory read requires a token, on both path prefixes")
        void readsRequireAToken() throws Exception {
            mockMvc.perform(get("/faculty-admins")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/faculty-admins/FA1")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/faculty-admins/FA1/engineers")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/engineers")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/engineers/E1")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/api/springboot-service/engineers"))
                .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("an engineer can read the directory but not change it")
        void engineersAreReadOnly() throws Exception {
            createEngineer("E1", "FA1", fa1);
            createEngineer("E2", "FA1", fa1);
            String e1 = login("E1");

            mockMvc.perform(as(e1, get("/faculty-admins"))).andExpect(status().isOk());
            mockMvc.perform(as(e1, get("/faculty-admins/FA1/engineers"))).andExpect(status().isOk());
            mockMvc.perform(as(e1, get("/engineers/E2"))).andExpect(status().isOk());

            mockMvc.perform(as(e1, post("/faculty-admins")).content(adminBody("FA2")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.message").value("Only a faculty admin can create a faculty admin"));
            mockMvc.perform(as(e1, post("/engineers")).content(engineerBody("E3", "FA1")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only a faculty admin can create engineers"));
            mockMvc.perform(as(e1, put("/faculty-admins/FA1/engineers/E2")))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(e1, delete("/faculty-admins/FA1/engineers/E2")))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(e1, delete("/engineers/E2")))
                .andExpect(status().isForbidden());

            assertThat(engineerRepository.findAll()).hasSize(2);
            assertThat(facultyAdminRepository.findAll()).hasSize(1);
        }

        @Test
        @DisplayName("an admin manages their own team, never another admin's")
        void adminsStayOnTheirOwnTeam() throws Exception {
            createAdmin("FA2", fa1);
            String fa2 = login("FA2");
            createEngineer("E1", "FA1", fa1);
            createEngineer("E2", "FA2", fa2);

            // Creating an engineer directly onto somebody else's team.
            mockMvc.perform(as(fa2, post("/engineers")).content(engineerBody("E3", "FA1")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message")
                    .value("Only faculty admin FA1 can add engineers to this team"));

            // Changing somebody else's team through their path.
            mockMvc.perform(as(fa2, put("/faculty-admins/FA1/engineers/E2")))
                .andExpect(status().isForbidden());
            mockMvc.perform(as(fa2, delete("/faculty-admins/FA1/engineers/E1")))
                .andExpect(status().isForbidden());

            // Deleting an engineer another admin manages.
            mockMvc.perform(as(fa2, delete("/engineers/E1")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Only faculty admin FA1 can delete engineer E1"));

            mockMvc.perform(as(fa1, get("/engineers/E1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.facultyAdminId").value("FA1"));
            mockMvc.perform(as(fa2, get("/engineers/E2")))
                .andExpect(jsonPath("$.facultyAdminId").value("FA2"));
        }

        @Test
        @DisplayName("an unmanaged engineer can be claimed or deleted by any admin")
        void unmanagedEngineersBelongToNobody() throws Exception {
            createAdmin("FA2", fa1);
            String fa2 = login("FA2");
            createEngineer("E1", null, fa1);
            createEngineer("E2", null, fa1);

            mockMvc.perform(as(fa2, put("/faculty-admins/FA2/engineers/E1")))
                .andExpect(status().isOk());
            mockMvc.perform(as(fa2, get("/engineers/E1")))
                .andExpect(jsonPath("$.facultyAdminId").value("FA2"));

            mockMvc.perform(as(fa2, delete("/engineers/E2")))
                .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("naming an admin that does not exist when creating an engineer is refused")
        void creatingAnEngineerUnderAnUnknownAdminIsRefused() throws Exception {
            // The caller is not that admin, whoever it is, so this is a 403 like any other team.
            mockMvc.perform(as(fa1, post("/engineers")).content(engineerBody("E1", "nope")))
                .andExpect(status().isForbidden());

            assertThat(engineerRepository.findAll()).isEmpty();
        }
    }

    /**
     * Adds the bearer token and JSON content type to a request.
     */
    private static MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder request) {
        return request
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON);
    }

    /**
     * Signs an employee in and returns their token. Every seeded account uses the password "pw".
     */
    private String login(String employeeId) throws Exception {
        String body = mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(String.format(
                    "{\"email\":\"%s@example.com\",\"password\":\"pw\"}", employeeId)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    /**
     * Creates a faculty admin through the API.
     *
     * @param employeeId the id to give the admin
     * @param token the creating admin's token, or null for the anonymous bootstrap call
     * @throws Exception if the request fails
     */
    private void createAdmin(String employeeId, String token) throws Exception {
        MockHttpServletRequestBuilder request = post("/faculty-admins")
            .contentType(MediaType.APPLICATION_JSON)
            .content(adminBody(employeeId));
        if (token != null) {
            request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
        }
        mockMvc.perform(request).andExpect(status().isCreated());
    }

    /**
     * Creates an engineer through the API.
     *
     * @param employeeId the id to give the engineer
     * @param facultyAdminId the managing admin's id, or null to leave the engineer unassigned
     * @param token the token of the creating admin, who must be the managing one when there is one
     * @throws Exception if the request fails
     */
    private void createEngineer(String employeeId, String facultyAdminId, String token)
        throws Exception {
        mockMvc.perform(as(token, post("/engineers")).content(engineerBody(employeeId, facultyAdminId)))
            .andExpect(status().isCreated());
    }

    /**
     * Builds a faculty admin create request body.
     *
     * @param employeeId the id to put in the body
     * @return the JSON body
     */
    private static String adminBody(String employeeId) {
        return String.format(
            "{\"email\":\"%s@example.com\",\"password\":\"pw\",\"employeeId\":\"%s\"}",
            employeeId, employeeId);
    }

    /**
     * Builds an engineer create request body.
     *
     * @param employeeId the id to put in the body
     * @param facultyAdminId the managing admin to name, or null to omit the field
     * @return the JSON body
     */
    private static String engineerBody(String employeeId, String facultyAdminId) {
        String admin = facultyAdminId == null
            ? ""
            : String.format(",\"facultyAdminId\":\"%s\"", facultyAdminId);
        return String.format(
            "{\"email\":\"%s@example.com\",\"password\":\"pw\",\"employeeId\":\"%s\"%s}",
            employeeId, employeeId, admin);
    }
}
