package com.example.model;

import com.example.auth.Caller;
import com.example.classes.Employee;
import com.example.classes.Engineer;
import com.example.classes.Role;

/**
 * An employee of either kind, as embedded in other responses.
 *
 * The one shape used wherever a report names a person — author, assignee, requester — so a client
 * renders them all the same way. Carries no password, like every other response record.
 *
 * @param employeeId the employee's identifier
 * @param email the employee's email address
 * @param role which kind of employee they are
 * @param facultyAdminId for an engineer, the managing admin's id; null for an admin or an unmanaged
 *     engineer
 */
public record EmployeeSummary(
    String employeeId,
    String email,
    Role role,
    String facultyAdminId
) {

    /**
     * Builds a summary from an employee.
     *
     * @param employee the employee
     * @return the summary
     */
    public static EmployeeSummary from(Employee employee) {
        String managedBy = employee instanceof Engineer engineer ? engineer.getFacultyAdminId() : null;
        return new EmployeeSummary(
            employee.getEmployeeId(), employee.getEmail(), Role.of(employee), managedBy);
    }

    /**
     * Builds a summary from the signed-in caller.
     *
     * @param caller the caller
     * @return the summary
     */
    public static EmployeeSummary from(Caller caller) {
        return new EmployeeSummary(
            caller.employeeId(), caller.email(), caller.role(), caller.facultyAdminId());
    }

    /**
     * Stands in for an employee who has been deleted but is still named by a report.
     *
     * @param employeeId the id the report still holds
     * @return a summary with only the id filled in
     */
    public static EmployeeSummary former(String employeeId) {
        return new EmployeeSummary(employeeId, null, null, null);
    }
}
