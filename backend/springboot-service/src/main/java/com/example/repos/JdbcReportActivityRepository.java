package com.example.repos;

import com.example.classes.ActivityKind;
import com.example.classes.ReportActivity;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Stores activity entries in PostgreSQL.
 */
@Repository
@Profile("!test")
public class JdbcReportActivityRepository implements ReportActivityRepository {

    /** Columns read by every query, matching the component order of {@link ActivityRow}. */
    private static final String COLUMNS =
        "activity_id, report_id, kind, author_id, body, created_at";

    /** Inserts an entry. Plain insert: entries are never replaced. */
    private static final String INSERT = """
        INSERT INTO report_activity (activity_id, report_id, kind, author_id, body, created_at)
        VALUES (:activityId, :reportId, :kind, :authorId, :body, :createdAt)
        """;

    /** Issues the SQL. */
    private final JdbcClient jdbcClient;

    /**
     * Creates the repository.
     *
     * @param jdbcClient the client bound to this service's data source
     */
    public JdbcReportActivityRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * One row of the activity table.
     *
     * @param activityId the identifier
     * @param reportId the report the entry belongs to
     * @param kind what the entry records, as stored
     * @param authorId who wrote it, null once that employee is gone
     * @param body the text
     * @param createdAt when it was written
     */
    private record ActivityRow(
        String activityId,
        String reportId,
        String kind,
        String authorId,
        String body,
        OffsetDateTime createdAt
    ) {

        /**
         * Rebuilds the domain object from this row.
         *
         * @return the entry
         */
        ReportActivity toActivity() {
            return new ReportActivity(
                activityId, reportId, ActivityKind.of(kind), authorId, body, createdAt.toInstant());
        }
    }

    @Override
    public ReportActivity append(ReportActivity activity) {
        jdbcClient.sql(INSERT)
            .param("activityId", activity.activityId())
            .param("reportId", activity.reportId())
            .param("kind", activity.kind().name())
            .param("authorId", activity.authorId())
            .param("body", activity.body())
            .param("createdAt", OffsetDateTime.ofInstant(activity.createdAt(), ZoneOffset.UTC))
            .update();
        return activity;
    }

    @Override
    public List<ReportActivity> findByReport(String reportId) {
        if (reportId == null) {
            return List.of();
        }
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report_activity"
                + " WHERE report_id = :reportId ORDER BY created_at, activity_id")
            .param("reportId", reportId)
            .query(ActivityRow.class)
            .list()
            .stream()
            .map(ActivityRow::toActivity)
            .toList();
    }

    @Override
    public void deleteAll() {
        jdbcClient.sql("DELETE FROM report_activity").update();
    }
}
