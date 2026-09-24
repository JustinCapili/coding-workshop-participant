package com.example.repos;

import com.example.classes.Employee;
import com.example.classes.Engineer;
import com.example.classes.FacultyAdmin;

/**
 * One row of the employee table, before it becomes a domain object.
 *
 * Every role lives in a single table, so a row is not yet an Employee, Engineer or FacultyAdmin — the
 * role column decides which. This record is the halfway point: what the query returned, not yet what
 * the domain calls it.
 *
 * Component names are the column names in camel case, which is how JdbcClient maps a result set onto
 * a record without a hand-written mapper.
 *
 * @param employeeId the identifier, and the primary key
 * @param role EMPLOYEE, ENGINEER or FACULTY_ADMIN
 * @param email the employee's email address
 * @param passwordHash the BCrypt digest of their password
 * @param facultyAdminId the managing admin's id for an engineer, null otherwise
 */
record EmployeeRow(
    String employeeId,
    String role,
    String email,
    String passwordHash,
    String facultyAdminId
) {

    /** Value of the role column for plain employees. */
    static final String ROLE_EMPLOYEE = "EMPLOYEE";

    /** Value of the role column for engineers. */
    static final String ROLE_ENGINEER = "ENGINEER";

    /** Value of the role column for faculty admins. */
    static final String ROLE_FACULTY_ADMIN = "FACULTY_ADMIN";

    /** Columns selected by every read, in the order the record declares them. */
    static final String COLUMNS = "employee_id, role, email, password_hash, faculty_admin_id";

    /**
     * Inserts an employee, or replaces the one already holding that id.
     *
     * The conflict clause is what makes save idempotent: calling it twice with the same id updates
     * rather than failing on the primary key. The check constraint on the table still has the final
     * say, so a row claiming to be a managed faculty admin is refused here rather than stored.
     */
    static final String UPSERT = """
        INSERT INTO employee (employee_id, role, email, password_hash, faculty_admin_id)
        VALUES (:employeeId, :role, :email, :passwordHash, :facultyAdminId)
        ON CONFLICT (employee_id) DO UPDATE SET
            role             = EXCLUDED.role,
            email            = EXCLUDED.email,
            password_hash    = EXCLUDED.password_hash,
            faculty_admin_id = EXCLUDED.faculty_admin_id
        """;

    /**
     * Rebuilds a plain employee from this row.
     *
     * @return the employee
     */
    Employee toEmployee() {
        return new Employee(email, passwordHash, employeeId);
    }

    /**
     * Rebuilds an engineer from this row.
     *
     * The managing admin is not set here. Linking is the caller's job, because it needs the admin
     * object and this record only carries an id.
     *
     * @return the engineer, unassigned
     */
    Engineer toEngineer() {
        return new Engineer(email, passwordHash, employeeId);
    }

    /**
     * Rebuilds a faculty admin from this row, managing nobody yet.
     *
     * @return the faculty admin, with an empty managed set
     */
    FacultyAdmin toFacultyAdmin() {
        return new FacultyAdmin(email, passwordHash, employeeId);
    }
}
