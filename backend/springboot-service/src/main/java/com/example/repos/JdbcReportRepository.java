package com.example.repos;

import com.example.classes.IncidentType;
import com.example.classes.Priority;
import com.example.classes.Report;
import com.example.classes.ReportStatus;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Stores reports in PostgreSQL.
 *
 * Simpler than the employee repositories, because a report holds no references to other domain
 * objects — only an author id, which is provenance rather than a link worth rebuilding. Nothing here
 * loads a graph.
 */
@Repository
@Profile("!test")
public class JdbcReportRepository implements ReportRepository {

    /** Columns read by every query, matching the component order of {@link ReportRow}. */
    private static final String COLUMNS =
        "report_id, title, body, location, status, author_id, created_at, updated_at,"
            + " incident_type, priority";

    /**
     * Inserts a report, or replaces the one already holding that id.
     *
     * updated_at is taken from the object rather than from now(), so that a caller who has not
     * touched the report does not silently bump its modification time.
     */
    private static final String UPSERT = """
        INSERT INTO report (report_id, title, body, location, status, author_id,
                            created_at, updated_at, incident_type, priority)
        VALUES (:reportId, :title, :body, :location, :status, :authorId,
                :createdAt, :updatedAt, :incidentType, :priority)
        ON CONFLICT (report_id) DO UPDATE SET
            title         = EXCLUDED.title,
            body          = EXCLUDED.body,
            location      = EXCLUDED.location,
            status        = EXCLUDED.status,
            updated_at    = EXCLUDED.updated_at,
            incident_type = EXCLUDED.incident_type,
            priority      = EXCLUDED.priority
        """;

    /** Issues the SQL. */
    private final JdbcClient jdbcClient;

    /**
     * Creates the repository.
     *
     * @param jdbcClient the client bound to this service's data source
     */
    public JdbcReportRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * One row of the report table.
     *
     * Timestamps arrive as OffsetDateTime because that is what the PostgreSQL driver returns for
     * timestamptz; the domain keeps them as Instant.
     *
     * @param reportId the identifier
     * @param title the short description
     * @param body the body text
     * @param location where the report applies
     * @param status the lifecycle state, as stored
     * @param authorId the author's employee id, null once that employee is gone
     * @param createdAt when the report was filed
     * @param updatedAt when the report was last modified
     */
    private record ReportRow(
        String reportId,
        String title,
        String body,
        String location,
        String status,
        String authorId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String incidentType,
        String priority
    ) {

        /**
         * Rebuilds the domain object from this row.
         *
         * @return the report
         */
        Report toReport() {
            return new Report(
                reportId, title, body, location, ReportStatus.of(status), authorId,
                createdAt.toInstant(), updatedAt.toInstant())
                .classify(IncidentType.of(incidentType), Priority.of(priority));
        }
    }

    @Override
    public Report save(Report report) {
        jdbcClient.sql(UPSERT)
            .param("reportId", report.getReportId())
            .param("title", report.getTitle())
            .param("body", report.getBody())
            .param("location", report.getLocation())
            .param("status", report.getStatus().name())
            .param("authorId", report.getAuthorId())
            .param("createdAt", OffsetDateTime.ofInstant(report.getCreatedAt(),
                java.time.ZoneOffset.UTC))
            .param("updatedAt", OffsetDateTime.ofInstant(report.getUpdatedAt(),
                java.time.ZoneOffset.UTC))
            .param("incidentType",
                report.getIncidentType() == null ? null : report.getIncidentType().name())
            .param("priority", report.getPriority() == null ? null : report.getPriority().name())
            .update();
        return report;
    }

    @Override
    public Optional<Report> findById(String id) {
        if (id == null) {
            return Optional.empty();
        }
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report WHERE report_id = :id")
            .param("id", id)
            .query(ReportRow.class)
            .optional()
            .map(ReportRow::toReport);
    }

    @Override
    public List<Report> findAll() {
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report ORDER BY created_at DESC")
            .query(ReportRow.class)
            .list()
            .stream()
            .map(ReportRow::toReport)
            .toList();
    }

    @Override
    public List<Report> findByLocation(String location) {
        if (location == null) {
            return List.of();
        }
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report"
                + " WHERE location = :location ORDER BY created_at DESC")
            .param("location", location)
            .query(ReportRow.class)
            .list()
            .stream()
            .map(ReportRow::toReport)
            .toList();
    }

    @Override
    public boolean deleteById(String id) {
        if (id == null) {
            return false;
        }
        // Grants on this report go with it: report_assignment.report_id is ON DELETE CASCADE.
        return jdbcClient.sql("DELETE FROM report WHERE report_id = :id")
            .param("id", id)
            .update() > 0;
    }

    @Override
    public boolean existsById(String id) {
        if (id == null) {
            return false;
        }
        return jdbcClient.sql("SELECT count(*) FROM report WHERE report_id = :id")
            .param("id", id)
            .query(Long.class)
            .single() > 0;
    }

    @Override
    public void deleteAll() {
        jdbcClient.sql("DELETE FROM report").update();
    }
}
