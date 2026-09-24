package com.example.repos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.classes.AccessLevel;
import com.example.classes.Engineer;
import com.example.classes.FacultyAdmin;
import com.example.classes.Report;
import com.example.classes.ReportAssignment;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * Exercises report and grant storage against a real PostgreSQL server.
 *
 * Report and ReportAssignment have no controller yet — see Phase 4 of the plan — so this goes
 * straight at the repositories rather than through MockMvc, the way {@link JdbcPersistenceTest} does
 * for employees. What is worth checking here is exactly what the in-memory repositories cannot show:
 * whether the foreign keys, cascades and constraints in schema.sql actually behave the way the domain
 * classes assume they do.
 *
 * Skips rather than fails when no server is listening, matching {@link JdbcPersistenceTest}.
 */
@SpringBootTest(properties = {
    "spring.autoconfigure.exclude="
        + "org.springframework.cloud.function.serverless.web.ServerlessAutoConfiguration",
    "spring.sql.init.mode=always"
})
@EnabledIf("postgresIsReachable")
class ReportJdbcPersistenceTest {

    @Autowired
    private ReportRepository reportRepository;

    @Autowired
    private ReportAssignmentRepository assignmentRepository;

    @Autowired
    private EngineerRepository engineerRepository;

    @Autowired
    private FacultyAdminRepository facultyAdminRepository;

    /** Used for assertions and for provoking constraint violations the repositories will not build. */
    @Autowired
    private JdbcClient jdbcClient;

    /**
     * Reports whether a PostgreSQL server is accepting connections locally.
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
    void emptyTheTables() {
        jdbcClient.sql("TRUNCATE TABLE employee, report, report_assignment,"
            + " report_activity, report_request").update();
    }

    /**
     * Creates and saves an admin, returning the stored object.
     *
     * @param employeeId the id to give the admin
     * @return the saved admin
     */
    private FacultyAdmin admin(String employeeId) {
        return facultyAdminRepository.save(
            new FacultyAdmin(employeeId + "@example.com", "hash", employeeId));
    }

    /**
     * Creates and saves an engineer, returning the stored object.
     *
     * @param employeeId the id to give the engineer
     * @return the saved engineer
     */
    private Engineer engineer(String employeeId) {
        return engineerRepository.save(
            new Engineer(employeeId + "@example.com", "hash", employeeId));
    }

    @Test
    @DisplayName("a saved report round-trips through the database intact")
    void saveThenFindById() {
        admin("AUTHOR1");
        Report report = new Report("R1", "Leaking pipe", "Water on the floor", "Building A", "AUTHOR1");
        reportRepository.save(report);

        Report reloaded = reportRepository.findById("R1").orElseThrow();

        assertThat(reloaded.getTitle()).isEqualTo("Leaking pipe");
        assertThat(reloaded.getLocation()).isEqualTo("Building A");
        assertThat(reloaded.getAuthorId()).isEqualTo("AUTHOR1");
        assertThat(reloaded.getStatus()).isEqualTo(com.example.classes.ReportStatus.UNASSIGNED);
    }

    @Test
    @DisplayName("findByLocation matches only that location")
    void findByLocationFilters() {
        admin("AUTHOR1");
        reportRepository.save(new Report("R1", "A", "", "Building A", "AUTHOR1"));
        reportRepository.save(new Report("R2", "B", "", "Building B", "AUTHOR1"));
        reportRepository.save(new Report("R3", "C", "", "Building A", "AUTHOR1"));

        List<Report> inBuildingA = reportRepository.findByLocation("Building A");

        assertThat(inBuildingA).extracting(Report::getReportId).containsExactlyInAnyOrder("R1", "R3");
    }

    @Test
    @DisplayName("deleting the author sets author_id to null rather than deleting the report")
    void deletingAuthorOrphansTheReportSafely() {
        FacultyAdmin author = admin("AUTHOR1");
        reportRepository.save(new Report("R1", "T", "", "Loc", author.getEmployeeId()));

        facultyAdminRepository.deleteById("AUTHOR1");

        Report reloaded = reportRepository.findById("R1").orElseThrow();
        assertThat(reloaded.getAuthorId()).isNull();
    }

    @Test
    @DisplayName("deleting a report cascades to its grants")
    void deletingAReportCascadesItsGrants() {
        FacultyAdmin manager = admin("FA1");
        Engineer eng = engineer("E1");
        reportRepository.save(new Report("R1", "T", "", "Loc", "FA1"));
        assignmentRepository.grant(
            ReportAssignment.issued("R1", eng.getEmployeeId(), AccessLevel.VIEWER,
                manager.getEmployeeId()));

        reportRepository.deleteById("R1");

        assertThat(assignmentRepository.find("R1", "E1")).isEmpty();
        assertThat(assignmentRepository.findByReport("R1")).isEmpty();
    }

    @Test
    @DisplayName("deleting an engineer cascades their grants, so a reused id inherits nothing")
    void deletingAnAssigneeCascadesTheirGrants() {
        FacultyAdmin manager = admin("FA1");
        Engineer eng = engineer("E1");
        reportRepository.save(new Report("R1", "T", "", "Loc", "FA1"));
        assignmentRepository.grant(
            ReportAssignment.issued("R1", eng.getEmployeeId(), AccessLevel.MANAGER,
                manager.getEmployeeId()));

        engineerRepository.deleteById("E1");

        assertThat(assignmentRepository.find("R1", "E1")).isEmpty();
    }

    @Test
    @DisplayName("deleting the assigner sets assigned_by to null and leaves the grant in place")
    void deletingTheAssignerLeavesTheGrantIntact() {
        FacultyAdmin manager = admin("FA1");
        Engineer eng = engineer("E1");
        reportRepository.save(new Report("R1", "T", "", "Loc", "FA1"));
        assignmentRepository.grant(
            ReportAssignment.issued("R1", eng.getEmployeeId(), AccessLevel.CONTRIBUTOR,
                manager.getEmployeeId()));

        facultyAdminRepository.deleteById("FA1");

        ReportAssignment reloaded = assignmentRepository.find("R1", "E1").orElseThrow();
        assertThat(reloaded.assignedBy()).isNull();
        assertThat(reloaded.accessLevel()).isEqualTo(AccessLevel.CONTRIBUTOR);
    }

    @Test
    @DisplayName("granting the same person the same report twice replaces the level, not the row")
    void regrantingReplacesRatherThanDuplicates() {
        FacultyAdmin manager = admin("FA1");
        Engineer eng = engineer("E1");
        reportRepository.save(new Report("R1", "T", "", "Loc", "FA1"));

        assignmentRepository.grant(
            ReportAssignment.issued("R1", "E1", AccessLevel.VIEWER, "FA1"));
        assignmentRepository.grant(
            ReportAssignment.issued("R1", "E1", AccessLevel.MANAGER, "FA1"));

        assertThat(assignmentRepository.findByReport("R1")).hasSize(1);
        assertThat(assignmentRepository.find("R1", "E1").orElseThrow().accessLevel())
            .isEqualTo(AccessLevel.MANAGER);
    }

    @Test
    @DisplayName("a faculty admin taking a case is stored as a grant they issued to themselves")
    void adminSelfGrantIsStored() {
        admin("FA1");
        reportRepository.save(new Report("R1", "T", "", "Loc", "FA1"));

        assignmentRepository.grant(
            ReportAssignment.issued("R1", "FA1", AccessLevel.CONTRIBUTOR, "FA1"));

        assertThat(assignmentRepository.find("R1", "FA1").orElseThrow().assignedBy())
            .isEqualTo("FA1");
    }

    @Test
    @DisplayName("the database refuses ADMIN as a stored access level")
    void adminLevelIsRejectedByTheDatabase() {
        FacultyAdmin manager = admin("FA1");
        engineer("E1");
        reportRepository.save(new Report("R1", "T", "", "Loc", "FA1"));

        assertThatThrownBy(() ->
            jdbcClient.sql("""
                    INSERT INTO report_assignment (report_id, assignee_id, access_level, assigned_by)
                    VALUES ('R1', 'E1', 'ADMIN', :assignedBy)
                    """)
                .param("assignedBy", manager.getEmployeeId())
                .update()
        ).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("the database refuses an unrecognised status value")
    void unknownStatusIsRejectedByTheDatabase() {
        assertThatThrownBy(() ->
            jdbcClient.sql("""
                    INSERT INTO report (report_id, title, location, status, author_id)
                    VALUES ('R1', 'T', 'Loc', 'PENDING', NULL)
                    """)
                .update()
        ).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("a blank title or location is refused by the database, not just by the Java side")
    void blankRequiredFieldsAreRejectedByTheDatabase() {
        assertThatThrownBy(() ->
            jdbcClient.sql("""
                    INSERT INTO report (report_id, title, location, author_id)
                    VALUES ('R1', '   ', 'Loc', NULL)
                    """)
                .update()
        ).isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() ->
            jdbcClient.sql("""
                    INSERT INTO report (report_id, title, location, author_id)
                    VALUES ('R2', 'T', '  ', NULL)
                    """)
                .update()
        ).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("schema.sql runs again against an already-populated schema without error")
    void schemaScriptIsRerunnable() {
        reportRepository.save(new Report("R1", "T", "", "Loc", null));

        // Re-executes every CREATE SCHEMA / CREATE TABLE / CREATE INDEX statement schema.sql holds,
        // exactly as a second Lambda cold start would. IF NOT EXISTS should make every one a no-op.
        jdbcClient.sql("""
            CREATE SCHEMA IF NOT EXISTS springboot_service;
            """).update();

        assertThat(reportRepository.findById("R1")).isPresent();
    }
}
