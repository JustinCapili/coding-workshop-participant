package com.example.repos;

import com.example.classes.ReportAssignment;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * Keeps grants in a map, for tests and for running without a database.
 *
 * Active only under the test profile; {@link JdbcReportAssignmentRepository} takes its place
 * everywhere else.
 *
 * The map is keyed on report and assignee together, which is how the composite primary key on the
 * table behaves: storing a second grant for the same pair replaces the first rather than adding one.
 */
@Repository
@Profile("test")
public class InMemoryReportAssignmentRepository implements ReportAssignmentRepository {

    /** Grants by report and assignee. */
    private final Map<Key, ReportAssignment> grants = new ConcurrentHashMap<>();

    /**
     * The composite key the grant table uses.
     *
     * @param reportId the report
     * @param assigneeId the employee id of the person granted access
     */
    private record Key(String reportId, String assigneeId) {
    }

    @Override
    public ReportAssignment grant(ReportAssignment assignment) {
        Objects.requireNonNull(assignment, "assignment must not be null");
        grants.put(new Key(assignment.reportId(), assignment.assigneeId()), assignment);
        return assignment;
    }

    @Override
    public Optional<ReportAssignment> find(String reportId, String assigneeId) {
        if (reportId == null || assigneeId == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(grants.get(new Key(reportId, assigneeId)));
    }

    @Override
    public List<ReportAssignment> findByReport(String reportId) {
        if (reportId == null) {
            return List.of();
        }
        return grants.values().stream()
            .filter(grant -> reportId.equals(grant.reportId()))
            .toList();
    }

    @Override
    public List<ReportAssignment> findByAssignee(String assigneeId) {
        if (assigneeId == null) {
            return List.of();
        }
        return grants.values().stream()
            .filter(grant -> assigneeId.equals(grant.assigneeId()))
            .toList();
    }

    @Override
    public boolean revoke(String reportId, String assigneeId) {
        if (reportId == null || assigneeId == null) {
            return false;
        }
        return grants.remove(new Key(reportId, assigneeId)) != null;
    }

    @Override
    public void deleteAll() {
        grants.clear();
    }
}
