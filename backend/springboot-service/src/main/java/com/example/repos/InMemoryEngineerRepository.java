package com.example.repos;

import com.example.classes.Engineer;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * Keeps engineers in a map, for tests and for running without a database.
 *
 * Active only under the test profile. Everywhere else JdbcEngineerRepository takes its place, so the
 * deployed service never stores anything here.
 *
 * Kept rather than deleted because it is what lets the controller tests exercise the whole HTTP
 * surface without a PostgreSQL server: they are checking routing, status codes and the shape of the
 * responses, none of which needs a database to be meaningful.
 */
@Repository
@Profile("test")
public class InMemoryEngineerRepository
    extends InMemoryRepository<Engineer>
    implements EngineerRepository {

    @Override
    protected String idOf(Engineer engineer) {
        return engineer.getEmployeeId();
    }
}
