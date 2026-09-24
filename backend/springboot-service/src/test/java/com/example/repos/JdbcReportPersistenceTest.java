package com.example.repos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
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
 * Proves the report tables are written and read back through PostgreSQL.
 *
 * Same arrangement as {@link JdbcPersistenceTest}: no test profile, so the JDBC repositories are
 * wired in and schema.sql runs for real, and the whole class is skipped when nothing is listening
 * on the local PostgreSQL port.
 */
@SpringBootTest(properties = {
    "spring.autoconfigure.exclude="
        + "org.springframework.cloud.function.serverless.web.ServerlessAutoConfiguration",
    "spring.sql.init.mode=always"
})
@AutoConfigureMockMvc
@EnabledIf("com.example.repos.JdbcPersistenceTest#postgresIsReachable")
class JdbcReportPersistenceTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcClient jdbcClient;

    private String admin;
    private String engineer;

    @BeforeEach
    void emptyTablesAndSeedATeam() throws Exception {
        jdbcClient.sql("TRUNCATE TABLE employee, report, report_assignment,"
            + " report_activity, report_request").update();
        // The first admin needs no token (bootstrap); the engineer is provisioned by that admin.
        mockMvc.perform(post("/faculty-admins")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"FA1@acme.inc\",\"password\":\"pw\",\"employeeId\":\"FA1\"}"))
            .andExpect(status().isCreated());
        admin = login("FA1");
        mockMvc.perform(as(admin, post("/engineers"))
                .content("{\"email\":\"E1@acme.inc\",\"password\":\"pw\",\"employeeId\":\"E1\","
                    + "\"facultyAdminId\":\"FA1\"}"))
            .andExpect(status().isCreated());
        engineer = login("E1");
    }

    @Test
    @DisplayName("a filed report becomes a row, and reads back with its author resolved")
    void filingWritesARow() throws Exception {
        String reportId = file();

        Map<String, Object> row = jdbcClient
            .sql("SELECT title, location, status, author_id FROM report WHERE report_id = :id")
            .param("id", reportId)
            .query()
            .singleRow();
        assertThat(row).containsEntry("title", "Leak")
            .containsEntry("location", "Kitchen")
            .containsEntry("status", "UNASSIGNED")
            .containsEntry("author_id", "E1");

        mockMvc.perform(as(admin, get("/reports/" + reportId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.author.email").value("E1@acme.inc"));
    }

    @Test
    @DisplayName("the request, grant and thread each land in their own table")
    void approvalWritesGrantRequestAndThread() throws Exception {
        String reportId = file();

        String requestId = JsonPath.read(
            mockMvc.perform(as(engineer, post("/reports/" + reportId + "/assignment-requests")))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(),
            "$.requestId");
        mockMvc.perform(as(admin, post("/reports/assignment-requests/" + requestId + "/approve")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ASSIGNED"));

        Map<String, Object> request = jdbcClient
            .sql("SELECT type, status, requested_by, resolved_by FROM report_request"
                + " WHERE request_id = :id")
            .param("id", requestId)
            .query()
            .singleRow();
        assertThat(request).containsEntry("type", "ASSIGNMENT")
            .containsEntry("status", "APPROVED")
            .containsEntry("requested_by", "E1")
            .containsEntry("resolved_by", "FA1");

        Map<String, Object> grant = jdbcClient
            .sql("SELECT access_level, assigned_by FROM report_assignment WHERE report_id = :id")
            .param("id", reportId)
            .query()
            .singleRow();
        assertThat(grant).containsEntry("access_level", "CONTRIBUTOR")
            .containsEntry("assigned_by", "FA1");

        List<String> kinds = jdbcClient
            .sql("SELECT kind FROM report_activity WHERE report_id = :id ORDER BY created_at")
            .param("id", reportId)
            .query(String.class)
            .list();
        assertThat(kinds).containsExactlyInAnyOrder("REQUEST", "ASSIGNMENT", "STATUS");

        assertThat(jdbcClient.sql("SELECT status FROM report WHERE report_id = :id")
            .param("id", reportId).query(String.class).single()).isEqualTo("ASSIGNED");
    }

    @Test
    @DisplayName("deleting a report takes its thread, grants and requests with it")
    void deletingAReportCascades() throws Exception {
        String reportId = file();
        mockMvc.perform(as(engineer, post("/reports/" + reportId + "/assignment-requests")))
            .andExpect(status().isCreated());
        mockMvc.perform(as(admin, put("/reports/" + reportId + "/assignees"))
                .content("{\"engineerIds\":[\"E1\"]}"))
            .andExpect(status().isOk());

        jdbcClient.sql("DELETE FROM report WHERE report_id = :id").param("id", reportId).update();

        for (String table : List.of("report_assignment", "report_activity", "report_request")) {
            Long left = jdbcClient.sql("SELECT count(*) FROM " + table + " WHERE report_id = :id")
                .param("id", reportId)
                .query(Long.class)
                .single();
            assertThat(left).as(table).isZero();
        }
    }

    private String file() throws Exception {
        return JsonPath.read(
            mockMvc.perform(as(engineer, post("/reports"))
                    .content("{\"title\":\"Leak\",\"location\":\"Kitchen\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(),
            "$.reportId");
    }

    private String login(String employeeId) throws Exception {
        return JsonPath.read(
            mockMvc.perform(post("/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(String.format(
                        "{\"email\":\"%s@acme.inc\",\"password\":\"pw\"}", employeeId)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(),
            "$.token");
    }

    private static MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder request) {
        return request
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON);
    }
}
