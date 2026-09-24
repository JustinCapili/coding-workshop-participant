package com.example.repos;

import com.example.classes.Engineer;
import com.example.classes.FacultyAdmin;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Stores engineers in PostgreSQL, in the shared employee table.
 *
 * The managing admin is written as the faculty_admin_id column of the engineer's own row, so saving
 * an engineer is what persists the relationship. A controller that moves an engineer between admins
 * changes the domain objects and then saves the engineer; there is no second call to make.
 *
 * Reads rebuild the link in the other direction. An engineer who has an admin is returned with that
 * admin attached, and the admin arrives with its full set of engineers rather than just this one —
 * a partially populated admin would be a trap for anyone who called getManagedEngineers on it.
 */
@Repository
@Profile("!test")
public class JdbcEngineerRepository implements EngineerRepository {

    /** Issues the SQL. */
    private final JdbcClient jdbcClient;

    /**
     * Creates the repository.
     *
     * @param jdbcClient the client bound to this service's data source
     */
    public JdbcEngineerRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    /**
     * {@inheritDoc}
     *
     * Writes the managing admin's id alongside the engineer's own columns, which is what makes the
     * relationship durable. An unassigned engineer stores null there.
     */
    @Override
    public Engineer save(Engineer engineer) {
        jdbcClient.sql(EmployeeRow.UPSERT)
            .param("employeeId", engineer.getEmployeeId())
            .param("role", EmployeeRow.ROLE_ENGINEER)
            .param("email", engineer.getEmail())
            .param("passwordHash", engineer.getPassword())
            .param("facultyAdminId", engineer.getFacultyAdminId())
            .update();
        return engineer;
    }

    /**
     * {@inheritDoc}
     *
     * An unassigned engineer costs one query. An assigned one costs two more, because its admin is
     * loaded complete with every engineer that admin manages, and the instance returned is the one
     * belonging to that graph.
     */
    @Override
    public Optional<Engineer> findById(String id) {
        if (id == null) {
            return Optional.empty();
        }
        Optional<EmployeeRow> row = jdbcClient.sql(
                "SELECT " + EmployeeRow.COLUMNS + " FROM employee"
                    + " WHERE employee_id = :id AND role = :role")
            .param("id", id)
            .param("role", EmployeeRow.ROLE_ENGINEER)
            .query(EmployeeRow.class)
            .optional();

        if (row.isEmpty()) {
            return Optional.empty();
        }
        if (row.get().facultyAdminId() == null) {
            return Optional.of(row.get().toEngineer());
        }

        // Rebuild the whole admin so its managed set is complete, then pick this engineer out of it.
        // Building an engineer here and hanging a half-loaded admin off it would be cheaper and
        // quietly wrong.
        return loadAdminGraph(row.get().facultyAdminId()).stream()
            .filter(engineer -> engineer.getEmployeeId().equals(id))
            .findFirst();
    }

    @Override
    public List<Engineer> findAll() {
        Map<String, FacultyAdmin> admins = new HashMap<>();
        jdbcClient.sql(
                "SELECT " + EmployeeRow.COLUMNS + " FROM employee WHERE role = :role")
            .param("role", EmployeeRow.ROLE_FACULTY_ADMIN)
            .query(EmployeeRow.class)
            .list()
            .forEach(adminRow -> admins.put(adminRow.employeeId(), adminRow.toFacultyAdmin()));

        List<Engineer> engineers = new ArrayList<>();
        jdbcClient.sql("SELECT " + EmployeeRow.COLUMNS + " FROM employee WHERE role = :role")
            .param("role", EmployeeRow.ROLE_ENGINEER)
            .query(EmployeeRow.class)
            .list()
            .forEach(engineerRow -> {
                Engineer engineer = engineerRow.toEngineer();
                FacultyAdmin admin = admins.get(engineerRow.facultyAdminId());
                if (admin != null) {
                    admin.addEngineer(engineer);
                }
                engineers.add(engineer);
            });

        return List.copyOf(engineers);
    }

    @Override
    public boolean deleteById(String id) {
        if (id == null) {
            return false;
        }
        return jdbcClient.sql("DELETE FROM employee WHERE employee_id = :id AND role = :role")
            .param("id", id)
            .param("role", EmployeeRow.ROLE_ENGINEER)
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
            .param("role", EmployeeRow.ROLE_ENGINEER)
            .query(Long.class)
            .single() > 0;
    }

    @Override
    public void deleteAll() {
        jdbcClient.sql("DELETE FROM employee WHERE role = :role")
            .param("role", EmployeeRow.ROLE_ENGINEER)
            .update();
    }

    /**
     * Loads one admin together with every engineer it manages, linked in both directions.
     *
     * @param facultyAdminId the managing admin's employee id
     * @return that admin's engineers, each carrying a back-reference to it
     */
    private List<Engineer> loadAdminGraph(String facultyAdminId) {
        Optional<FacultyAdmin> admin = jdbcClient.sql(
                "SELECT " + EmployeeRow.COLUMNS + " FROM employee"
                    + " WHERE employee_id = :id AND role = :role")
            .param("id", facultyAdminId)
            .param("role", EmployeeRow.ROLE_FACULTY_ADMIN)
            .query(EmployeeRow.class)
            .optional()
            .map(EmployeeRow::toFacultyAdmin);

        if (admin.isEmpty()) {
            return List.of();
        }

        jdbcClient.sql(
                "SELECT " + EmployeeRow.COLUMNS + " FROM employee"
                    + " WHERE faculty_admin_id = :adminId AND role = :role")
            .param("adminId", facultyAdminId)
            .param("role", EmployeeRow.ROLE_ENGINEER)
            .query(EmployeeRow.class)
            .list()
            .forEach(row -> admin.get().addEngineer(row.toEngineer()));

        return admin.get().getManagedEngineers();
    }
}
