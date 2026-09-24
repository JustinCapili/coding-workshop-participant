package com.example.repos;

import com.example.classes.ReportRequest;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * Keeps requests in a map, for tests and for running without a database.
 *
 * Active only under the test profile; {@link JdbcReportRequestRepository} takes its place
 * everywhere else.
 */
@Repository
@Profile("test")
public class InMemoryReportRequestRepository implements ReportRequestRepository {

    /** Requests by id. */
    private final Map<String, ReportRequest> requests = new ConcurrentHashMap<>();

    @Override
    public ReportRequest save(ReportRequest request) {
        Objects.requireNonNull(request, "request must not be null");
        requests.put(request.requestId(), request);
        return request;
    }

    @Override
    public Optional<ReportRequest> findById(String requestId) {
        return requestId == null ? Optional.empty() : Optional.ofNullable(requests.get(requestId));
    }

    @Override
    public List<ReportRequest> findByReport(String reportId) {
        if (reportId == null) {
            return List.of();
        }
        return requests.values().stream()
            .filter(request -> reportId.equals(request.reportId()))
            .sorted(Comparator.comparing(ReportRequest::requestedAt))
            .toList();
    }

    @Override
    public List<ReportRequest> findAll() {
        return requests.values().stream()
            .sorted(Comparator.comparing(ReportRequest::requestedAt))
            .toList();
    }

    @Override
    public void deleteAll() {
        requests.clear();
    }
}
