package com.example.repos;

import com.example.classes.Employee;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * Keeps plain employees in a map, for tests and for running without a database.
 *
 * Active only under the test profile, like {@link InMemoryEngineerRepository}; everywhere else
 * JdbcEmployeeRepository takes its place.
 */
@Repository
@Profile("test")
public class InMemoryEmployeeRepository
    extends InMemoryRepository<Employee>
    implements EmployeeRepository {

    @Override
    protected String idOf(Employee employee) {
        return employee.getEmployeeId();
    }
}
