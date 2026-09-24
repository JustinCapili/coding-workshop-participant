package com.example.repos;

import com.example.classes.Report;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * Keeps reports in a map, for tests and for running without a database.
 *
 * Active only under the test profile; {@link JdbcReportRepository} takes its place everywhere else.
 */
@Repository
@Profile("test")
public class InMemoryReportRepository
    extends InMemoryRepository<Report>
    implements ReportRepository {

    @Override
    protected String idOf(Report report) {
        return report.getReportId();
    }

    @Override
    public List<Report> findByLocation(String location) {
        if (location == null) {
            return List.of();
        }
        return findAll().stream()
            .filter(report -> location.equals(report.getLocation()))
            .toList();
    }
}
