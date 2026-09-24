package com.example.repos;

import com.example.classes.ReportRequest;
import com.example.classes.RequestStatus;
import com.example.classes.RequestType;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Stores requests in PostgreSQL.
 */
@Repository
@Profile("!test")
public class JdbcReportRequestRepository implements ReportRequestRepository {

    /** Columns read by every query, matching the component order of {@link RequestRow}. */
    private static final String COLUMNS =
        "request_id, report_id, type, requested_by, requested_at, status, resolved_by, resolved_at";

    /**
     * Inserts a request, or records its resolution.
     *
     * Only the resolution columns are updated on conflict: who asked, when, and about what are
     * fixed once written.
     */
    private static final String UPSERT = """
        INSERT INTO report_request (request_id, report_id, type, requested_by, requested_at,
                                    status, resolved_by, resolved_at)
        VALUES (:requestId, :reportId, :type, :requestedBy, :requestedAt,
                :status, :resolvedBy, :resolvedAt)
        ON CONFLICT (request_id) DO UPDATE SET
            status      = EXCLUDED.status,
            resolved_by = EXCLUDED.resolved_by,
            resolved_at = EXCLUDED.resolved_at
        """;

    /** Issues the SQL. */
    private final JdbcClient jdbcClient;

    /**
     * Creates the repository.
     *
     * @param jdbcClient the client bound to this service's data source
     */
    public JdbcReportRequestRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * One row of the request table.
     *
     * @param requestId the identifier
     * @param reportId the report the request concerns
     * @param type what is being asked, as stored
     * @param requestedBy who asked
     * @param requestedAt when they asked
     * @param status where the request has reached, as stored
     * @param resolvedBy who decided, null while pending
     * @param resolvedAt when it was decided, null while pending
     */
    private record RequestRow(
        String requestId,
        String reportId,
        String type,
        String requestedBy,
        OffsetDateTime requestedAt,
        String status,
        String resolvedBy,
        OffsetDateTime resolvedAt
    ) {

        /**
         * Rebuilds the domain object from this row.
         *
         * @return the request
         */
        ReportRequest toRequest() {
            return new ReportRequest(
                requestId,
                reportId,
                RequestType.valueOf(type),
                requestedBy,
                requestedAt.toInstant(),
                RequestStatus.of(status),
                resolvedBy,
                resolvedAt == null ? null : resolvedAt.toInstant());
        }
    }

    @Override
    public ReportRequest save(ReportRequest request) {
        jdbcClient.sql(UPSERT)
            .param("requestId", request.requestId())
            .param("reportId", request.reportId())
            .param("type", request.type().name())
            .param("requestedBy", request.requestedBy())
            .param("requestedAt", OffsetDateTime.ofInstant(request.requestedAt(), ZoneOffset.UTC))
            .param("status", request.status().name())
            .param("resolvedBy", request.resolvedBy())
            .param("resolvedAt", request.resolvedAt() == null
                ? null
                : OffsetDateTime.ofInstant(request.resolvedAt(), ZoneOffset.UTC))
            .update();
        return request;
    }

    @Override
    public Optional<ReportRequest> findById(String requestId) {
        if (requestId == null) {
            return Optional.empty();
        }
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report_request WHERE request_id = :id")
            .param("id", requestId)
            .query(RequestRow.class)
            .optional()
            .map(RequestRow::toRequest);
    }

    @Override
    public List<ReportRequest> findByReport(String reportId) {
        if (reportId == null) {
            return List.of();
        }
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report_request"
                + " WHERE report_id = :reportId ORDER BY requested_at")
            .param("reportId", reportId)
            .query(RequestRow.class)
            .list()
            .stream()
            .map(RequestRow::toRequest)
            .toList();
    }

    @Override
    public List<ReportRequest> findAll() {
        return jdbcClient.sql("SELECT " + COLUMNS + " FROM report_request ORDER BY requested_at")
            .query(RequestRow.class)
            .list()
            .stream()
            .map(RequestRow::toRequest)
            .toList();
    }

    @Override
    public void deleteAll() {
        jdbcClient.sql("DELETE FROM report_request").update();
    }
}
