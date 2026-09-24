package com.example.model;

import com.example.classes.FacultyAdmin;
import java.util.List;

/**
 * A faculty admin, together with the engineers they manage, as returned by the API.
 *
 * Like EngineerResponse this carries no password. The nested engineers repeat this admin's id in
 * their own facultyAdminId field, which is harmless duplication and keeps a single engineer shape
 * across every endpoint.
 *
 * @param employeeId the admin's identifier
 * @param email the admin's email address
 * @param managedEngineers the engineers this admin manages, empty when none
 */
public record FacultyAdminResponse(
    String employeeId,
    String email,
    List<EngineerResponse> managedEngineers
) {

    /**
     * Builds a response from a faculty admin.
     *
     * @param facultyAdmin the faculty admin to convert
     * @return the response representation of that admin, including their managed engineers
     */
    public static FacultyAdminResponse from(FacultyAdmin facultyAdmin) {
        return new FacultyAdminResponse(
            facultyAdmin.getEmployeeId(),
            facultyAdmin.getEmail(),
            facultyAdmin.getManagedEngineers().stream()
                .map(EngineerResponse::from)
                .toList()
        );
    }
}
