package com.example.repos;

import com.example.classes.FacultyAdmin;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Stores faculty admins in PostgreSQL, in the shared employee table.
 *
 * Every read returns an admin with its managed engineers already attached. Rebuilding that link on
 * each read is what keeps the domain objects honest: the faculty_admin_id column is the system of
 * record, and the object graph is a view of it assembled for one request.
 *
 * The engineers are attached with {@link FacultyAdmin#addEngineer}, so the back-reference on each
 * engineer is set by the same code path the rest of the application uses. Nothing here reaches around
 * the domain to set one side of the link without the other.
 */
@Repository
@Profile("!test")
public class JdbcFacultyAdminRepository implements FacultyAdminRepository {

    /** Issues the SQL. */
    private final JdbcClient jdbcClient;

    /**
     * Creates the repository.
     *
     * @param jdbcClient the client bound to this service's data source
     */
    public JdbcFacultyAdminRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    @Override
    public FacultyAdmin save(FacultyAdmin facultyAdmin) {
        jdbcClient.sql(EmployeeRow.UPSERT)
            .param("employeeId", facultyAdmin.getEmployeeId())
            .param("role", EmployeeRow.ROLE_FACULTY_ADMIN)
            .param("email", facultyAdmin.getEmail())
            .param("passwordHash", facultyAdmin.getPassword())
            // An admin is never managed by anyone, which the table's check constraint also enforces.
            .param("facultyAdminId", null)
            .update();
        return facultyAdmin;
    }

    /**
     * {@inheritDoc}
     *
     * Two queries: the admin, then the engineers pointing at it. A join would read the admin's
     * columns once per engineer, which buys nothing here.
     */
    @Override
    public Optional<FacultyAdmin> findById(String id) {
        if (id == null) {
            return Optional.empty();
        }
        Optional<FacultyAdmin> admin = jdbcClient.sql(
                "SELECT " + EmployeeRow.COLUMNS + " FROM employee"
                    + " WHERE employee_id = :id AND role = :role")
            .param("id", id)
            .param("role", EmployeeRow.ROLE_FACULTY_ADMIN)
            .query(EmployeeRow.class)
            .optional()
            .map(EmployeeRow::toFacultyAdmin);

        admin.ifPresent(this::attachEngineers);
        return admin;
    }

    @Override
    public List<FacultyAdmin> findAll() {
        Map<String, FacultyAdmin> admins = jdbcClient.sql(
                "SELECT " + EmployeeRow.COLUMNS + " FROM employee WHERE role = :role")
            .param("role", EmployeeRow.ROLE_FACULTY_ADMIN)
            .query(EmployeeRow.class)
            .list()
            .stream()
            .map(EmployeeRow::toFacultyAdmin)
            .collect(Collectors.toMap(FacultyAdmin::getEmployeeId, Function.identity()));

        // One further query for every managed engineer at once, rather than one query per admin.
        jdbcClient.sql(
                "SELECT " + EmployeeRow.COLUMNS + " FROM employee"
                    + " WHERE role = :role AND faculty_admin_id IS NOT NULL")
            .param("role", EmployeeRow.ROLE_ENGINEER)
            .query(EmployeeRow.class)
            .list()
            .forEach(row -> {
                FacultyAdmin admin = admins.get(row.facultyAdminId());
                if (admin != null) {
                    admin.addEngineer(row.toEngineer());
                }
            });

        return List.copyOf(admins.values());
    }

    @Override
    public boolean deleteById(String id) {
        if (id == null) {
            return false;
        }
        // Engineers managed by this admin are not deleted with it. The foreign key is declared
        // ON DELETE SET NULL, so they survive and become unassigned.
        return jdbcClient.sql("DELETE FROM employee WHERE employee_id = :id AND role = :role")
            .param("id", id)
            .param("role", EmployeeRow.ROLE_FACULTY_ADMIN)
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
            .param("role", EmployeeRow.ROLE_FACULTY_ADMIN)
            .query(Long.class)
            .single() > 0;
    }

    @Override
    public void deleteAll() {
        jdbcClient.sql("DELETE FROM employee WHERE role = :role")
            .param("role", EmployeeRow.ROLE_FACULTY_ADMIN)
            .update();
    }

    /**
     * Loads the engineers this admin manages and links them to it.
     *
     * @param admin the admin to populate
     */
    private void attachEngineers(FacultyAdmin admin) {
        jdbcClient.sql(
                "SELECT " + EmployeeRow.COLUMNS + " FROM employee"
                    + " WHERE faculty_admin_id = :adminId AND role = :role")
            .param("adminId", admin.getEmployeeId())
            .param("role", EmployeeRow.ROLE_ENGINEER)
            .query(EmployeeRow.class)
            .list()
            .forEach(row -> admin.addEngineer(row.toEngineer()));
    }
}
