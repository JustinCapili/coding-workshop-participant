package com.example.model;

import com.example.classes.Engineer;

/**
 * An engineer as returned by the API.
 *
 * Two things are deliberately absent. There is no password field, so a password cannot reach a client
 * even if someone forgets to think about it. And the managing faculty admin appears as a flat id
 * rather than an object, which is what stops Jackson walking from an admin to its engineers and back
 * to the admin forever.
 *
 * @param employeeId the engineer's identifier
 * @param email the engineer's email１ address
 * @param facultyAdminId the employee id of the managing faculty admin, or null when unassigned
 */
public record EngineerResponse(
    String employeeId,
    String email,
    String facultyAdminId
) {

    /**
     * Builds a response from an engineer.
     *
     * @param engineer the engineer to convert
     * @return the response representation of that engineer
     */
    public static EngineerResponse from(Engineer engineer) {
        return new EngineerResponse(
            engineer.getEmployeeId(),
            engineer.getEmail(),
            engineer.getFacultyAdminId()
        );
    }
}
