package com.example.classes;

/**
 * The three kinds of employee this service knows how to sign in.
 *
 * Mirrors the values the employee table's role column accepts. Held as an enum so the API can
 * return a role without every caller comparing raw strings.
 */
public enum Role {

    /** A plain {@link Employee}: files reports and follows them, and is on no team. */
    EMPLOYEE,

    /** An {@link Engineer}. */
    ENGINEER,

    /** A {@link FacultyAdmin}. */
    FACULTY_ADMIN;

    /**
     * Derives the role from the concrete employee type.
     *
     * Both subclasses are checked before the base class, since every engineer and faculty admin is
     * also an {@link Employee}.
     *
     * @param employee the employee
     * @return the role matching their class
     * @throws IllegalArgumentException if the employee is a subclass this enum does not know
     */
    public static Role of(Employee employee) {
        if (employee instanceof FacultyAdmin) {
            return FACULTY_ADMIN;
        }
        if (employee instanceof Engineer) {
            return ENGINEER;
        }
        if (employee.getClass() == Employee.class) {
            return EMPLOYEE;
        }
        throw new IllegalArgumentException("Unknown employee type " + employee.getClass());
    }
}
