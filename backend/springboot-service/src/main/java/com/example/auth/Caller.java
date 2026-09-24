package com.example.auth;

import com.example.classes.Employee;
import com.example.classes.Engineer;
import com.example.classes.Role;

/**
 * The signed-in employee behind the current request.
 *
 * Resolved from the bearer token by {@link AuthInterceptor} and handed to controller methods that
 * declare a parameter of this type. Deliberately a flat value rather than the domain object, so that
 * nothing downstream can reach a password digest or mutate the directory by accident.
 *
 * The {@code require*} methods are the one place a role check turns into a 403, so every
 * "access denied" reads the same and no controller compares roles by hand.
 *
 * @param employeeId the caller's employee id
 * @param email the caller's email address
 * @param role which kind of employee they are
 * @param facultyAdminId for an engineer, the admin managing them; null for an admin or an unmanaged
 *     engineer
 */
public record Caller(
    String employeeId,
    String email,
    Role role,
    String facultyAdminId
) {

    /**
     * Builds a caller from an employee.
     *
     * @param employee the signed-in employee
     * @return the caller
     */
    public static Caller of(Employee employee) {
        String managedBy = employee instanceof Engineer engineer ? engineer.getFacultyAdminId() : null;
        return new Caller(employee.getEmployeeId(), employee.getEmail(), Role.of(employee), managedBy);
    }

    /**
     * Reports whether the caller is a faculty admin.
     *
     * @return true for a faculty admin
     */
    public boolean isFacultyAdmin() {
        return role == Role.FACULTY_ADMIN;
    }

    /**
     * Reports whether the caller is an engineer.
     *
     * @return true for an engineer
     */
    public boolean isEngineer() {
        return role == Role.ENGINEER;
    }

    /**
     * Reports whether the caller is the employee with the given id.
     *
     * @param otherEmployeeId an employee id
     * @return true when it is the caller's own
     */
    public boolean is(String otherEmployeeId) {
        return employeeId.equals(otherEmployeeId);
    }

    /**
     * Returns the team this caller belongs to: an admin's own id, or the id of the admin managing an
     * engineer.
     *
     * @return the team's faculty admin id, or null for an unmanaged engineer
     */
    public String teamId() {
        return isFacultyAdmin() ? employeeId : facultyAdminId;
    }

    /**
     * Refuses anyone who is not a faculty admin.
     *
     * @param action what they were trying to do, for the message
     * @throws ForbiddenException if the caller is not a faculty admin
     */
    public void requireFacultyAdmin(String action) {
        if (!isFacultyAdmin()) {
            throw new ForbiddenException("Only a faculty admin can " + action);
        }
    }

    /**
     * Refuses a faculty admin acting on a team other than their own. Engineers are refused outright.
     *
     * @param facultyAdminId the team being acted on
     * @param action what they were trying to do, for the message
     * @throws ForbiddenException if the caller is not the faculty admin who runs that team
     */
    public void requireOwnTeam(String facultyAdminId, String action) {
        requireFacultyAdmin(action);
        if (!is(facultyAdminId)) {
            throw new ForbiddenException("Only faculty admin " + facultyAdminId + " can " + action);
        }
    }
}
