package com.example.classes;

/**
 * A member of staff, identified by an employee id.
 *
 * The employee id is the single identifier used throughout this service: it is the repository key,
 * the path variable in every URL, and the value an engineer reports when asked which faculty admin
 * manages it. There is deliberately no second id per role.
 *
 * The id is final and has no setter. An entity whose identity changes while it is a key in a
 * repository map would strand its own entry under the old key, so identity is fixed at construction.
 */
public class Employee extends User {

    /** Immutable identifier for this employee, unique across all staff. */
    private final String employeeId;

    /**
     * Creates an employee with the given credentials and identifier.
     *
     * @param email the employee's email address
     * @param password the employee's password
     * @param employeeId the identifier for this employee, unique across all staff
     */
    public Employee(String email, String password, String employeeId) {
        super(email, password);
        this.employeeId = employeeId;
    }

    /**
     * Returns this employee's identifier.
     *
     * @return the employee id
     */
    public String getEmployeeId() {
        return employeeId;
    }

    /**
     * Two employees are the same when they are the same kind of employee with the same id.
     *
     * Identity comparison would be simpler and was enough while everything lived in a single map,
     * where one person meant one object. Once rows are read back from PostgreSQL that stops being
     * true: every query builds fresh objects, so the same person routinely exists as several
     * instances at once. Comparing by id is what stops a faculty admin listing the same engineer
     * twice after loading them through two different queries.
     *
     * The class is compared rather than using instanceof, so an engineer and a faculty admin could
     * never be equal even if they somehow shared an id.
     *
     * @param other the object to compare with
     * @return true when other is the same kind of employee with the same id
     */
    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (other == null || getClass() != other.getClass()) {
            return false;
        }
        return employeeId.equals(((Employee) other).employeeId);
    }

    /**
     * Hashes on the employee id.
     *
     * Safe to do only because that field is final. A hash built on something mutable, such as the
     * email address, would strand this object in any hash-based collection the moment it changed:
     * the collection would go on looking for it in the bucket it no longer belongs to.
     *
     * @return a hash code derived from the employee id
     */
    @Override
    public int hashCode() {
        return employeeId.hashCode();
    }
}
