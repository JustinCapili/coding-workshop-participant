package com.example.repos;

import com.example.classes.ReportActivity;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * Keeps activity entries in a map, for tests and for running without a database.
 *
 * Active only under the test profile; {@link JdbcReportActivityRepository} takes its place
 * everywhere else.
 */
@Repository
@Profile("test")
public class InMemoryReportActivityRepository implements ReportActivityRepository {

    /** Entries by id. */
    private final Map<String, ReportActivity> entries = new ConcurrentHashMap<>();

    @Override
    public ReportActivity append(ReportActivity activity) {
        Objects.requireNonNull(activity, "activity must not be null");
        entries.put(activity.activityId(), activity);
        return activity;
    }

    @Override
    public List<ReportActivity> findByReport(String reportId) {
        if (reportId == null) {
            return List.of();
        }
        return entries.values().stream()
            .filter(entry -> reportId.equals(entry.reportId()))
            .sorted(Comparator.comparing(ReportActivity::createdAt)
                .thenComparing(ReportActivity::activityId))
            .toList();
    }

    @Override
    public void deleteAll() {
        entries.clear();
    }
}
