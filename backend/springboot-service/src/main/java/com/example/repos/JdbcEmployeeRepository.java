package com.example.repos;

import com.example.classes.Employee;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Plain employees in the shared employee table, as the rows whose role is EMPLOYEE.
 *
 * Simpler than {@link JdbcEngineerRepository}: a plain employee is on no team, so there is no graph
 * to rebuild and faculty_admin_id is always null.
 */
@Repository
@Profile("!test")
public class JdbcEmployeeRepository implements EmployeeRepository {

    private final JdbcClient jdbcClient;

    public JdbcEmployeeRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @Override
    public Employee save(Employee employee) {
        jdbcClient.sql(EmployeeRow.UPSERT)
            .param("employeeId", employee.getEmployeeId())
            .param("role", EmployeeRow.ROLE_EMPLOYEE)
            .param("email", employee.getEmail())
            .param("passwordHash", employee.getPassword())
            .param("facultyAdminId", null)
            .update();
        return employee;
    }

    @Override
    public Optional<Employee> findById(String id) {
        if (id == null) {
            return Optional.empty();
        }
        return jdbcClient.sql(
                "SELECT " + EmployeeRow.COLUMNS + " FROM employee"
                    + " WHERE employee_id = :id AND role = :role")
            .param("id", id)
            .param("role", EmployeeRow.ROLE_EMPLOYEE)
            .query(EmployeeRow.class)
            .optional()
            .map(EmployeeRow::toEmployee);
    }

    @Override
    public List<Employee> findAll() {
        return jdbcClient.sql("SELECT " + EmployeeRow.COLUMNS + " FROM employee WHERE role = :role")
            .param("role", EmployeeRow.ROLE_EMPLOYEE)
            .query(EmployeeRow.class)
            .list()
            .stream()
            .map(EmployeeRow::toEmployee)
            .toList();
    }

    @Override
    public boolean deleteById(String id) {
        if (id == null) {
            return false;
        }
        return jdbcClient.sql("DELETE FROM employee WHERE employee_id = :id AND role = :role")
            .param("id", id)
            .param("role", EmployeeRow.ROLE_EMPLOYEE)
            .update() > 0;
    }

    @Override
    public boolean existsById(String id) {
        if (id == null) {
            return false;
        }
        return jdbcClient.sql(
                "SELECT count(*) FROM employee WHERE employee_id = :id AND role = :role")
            .param("id", id)
            .param("role", EmployeeRow.ROLE_EMPLOYEE)
            .query(Long.class)
            .single() > 0;
    }

    @Override
    public void deleteAll() {
        jdbcClient.sql("DELETE FROM employee WHERE role = :role")
            .param("role", EmployeeRow.ROLE_EMPLOYEE)
            .update();
    }
}
