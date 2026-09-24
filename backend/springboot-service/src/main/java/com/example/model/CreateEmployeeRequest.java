package com.example.model;

/**
 * Request body for creating an engineer or a faculty admin.
 *
 * A request record is not a stylistic choice here. None of the domain classes has a no-argument
 * constructor, so Jackson cannot build one directly — binding a request straight onto an Engineer
 * would fail at runtime rather than at compile time.
 *
 * @param email the new employee's email address
 * @param password the new employee's password
 * @param employeeId the identifier to give the new employee, unique across all staff
 * @param facultyAdminId the employee id of the faculty admin who should manage this engineer, null to
 *     leave the engineer unassigned; ignored when creating a faculty admin
 */
public record CreateEmployeeRequest(
    String email,
    String password,
    String employeeId,
    String facultyAdminId
) {
}
