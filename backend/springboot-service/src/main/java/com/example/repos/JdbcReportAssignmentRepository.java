package com.example.repos;

import com.example.classes.AccessLevel;
import com.example.classes.ReportAssignment;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Stores grants in PostgreSQL.
 *
 * Every read here answers an authorization question, so the queries are deliberately narrow: the one
 * that matters most, {@link #find(String, String)}, is a primary key lookup.
 */
@Repository
@Profile("!test")
public class JdbcReportAssignmentRepository implements ReportAssignmentRepository {

    /** Columns read by every query, matching the component order of {@link AssignmentRow}. */
    private static final String COLUMNS =
        "report_id, assignee_id, access_level, assigned_by, assigned_at";

    /**
     * Issues a grant, replacing any the same person already holds on the same report.
     *
     * The conflict target is the composite primary key, which is what makes raising or lowering
     * somebody's level one statement rather than a delete and an insert.
     */
    private static final String UPSERT = """
        INSERT INTO report_assignment (report_id, assignee_id, access_level,
                                       assigned_by, assigned_at)
        VALUES (:reportId, :assigneeId, :accessLevel, :assignedBy, :assignedAt)
        ON CONFLICT (report_id, assignee_id) DO UPDATE SET
            access_level = EXCLUDED.access_level,
            assigned_by  = EXCLUDED.assigned_by,
            assigned_at  = EXCLUDED.assigned_at
        """;

    /** Issues the SQL. */
    private final JdbcClient jdbcClient;

    /**
     * Creates the repository.
     *
     * @param jdbcClient the client bound to this service's data source
     */
    public JdbcReportAssignmentRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * One row of the grant table.
     *
     * @param reportId the report the grant applies to
     * @param assigneeId the employee id of the person granted access
     * @param accessLevel what they may do, as stored
     * @param assignedBy the issuing faculty admin, null for an author's own grant
     * @param assignedAt when the grant was issued
     */
    private record AssignmentRow(
        String reportId,
        String assigneeId,
        String accessLevel,
        String assignedBy,
        OffsetDateTime assignedAt
    ) {

        /**
         * Rebuilds the domain object from this row.
         *
         * @return the grant
         */
        ReportAssignment toAssignment() {
            return new ReportAssignment(
                reportId, assigneeId, AccessLevel.valueOf(accessLevel), assignedBy,
                assignedAt.toInstant());
        }
    }

    @Override
    public ReportAssignment grant(ReportAssignment assignment) {
        jdbcClient.sql(UPSERT)
            .param("reportId", assignment.reportId())
            .param("assigneeId", assignment.assigneeId())
            .param("accessLevel", assignment.accessLevel().name())
            .param("assignedBy", assignment.assignedBy())
            .param("assignedAt",
                OffsetDateTime.ofInstant(assignment.assignedAt(), ZoneOffset.UTC))
            .update();
        return assignment;
    }

    @Override
    public Optional<ReportAssignment> find(String reportId, String assigneeId) {
        if (reportId == null || assigneeId == null) {
            return Optional.empty();
        }
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report_assignment"
                + " WHERE report_id = :reportId AND assignee_id = :assigneeId")
            .param("reportId", reportId)
            .param("assigneeId", assigneeId)
            .query(AssignmentRow.class)
            .optional()
            .map(AssignmentRow::toAssignment);
    }

    @Override
    public List<ReportAssignment> findByReport(String reportId) {
        if (reportId == null) {
            return List.of();
        }
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report_assignment"
                + " WHERE report_id = :reportId ORDER BY assigned_at")
            .param("reportId", reportId)
            .query(AssignmentRow.class)
            .list()
            .stream()
            .map(AssignmentRow::toAssignment)
            .toList();
    }

    @Override
    public List<ReportAssignment> findByAssignee(String assigneeId) {
        if (assigneeId == null) {
            return List.of();
        }
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report_assignment"
                + " WHERE assignee_id = :assigneeId ORDER BY assigned_at")
            .param("assigneeId", assigneeId)
            .query(AssignmentRow.class)
            .list()
            .stream()
            .map(AssignmentRow::toAssignment)
            .toList();
    }

    @Override
    public boolean revoke(String reportId, String assigneeId) {
        if (reportId == null || assigneeId == null) {
            return false;
        }
        return jdbcClient.sql("DELETE FROM report_assignment"
                + " WHERE report_id = :reportId AND assignee_id = :assigneeId")
            .param("reportId", reportId)
            .param("assigneeId", assigneeId)
            .update() > 0;
    }

    @Override
    public void deleteAll() {
        jdbcClient.sql("DELETE FROM report_assignment").update();
    }
}
