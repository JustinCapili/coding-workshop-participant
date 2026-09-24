package com.example.model;

import com.example.classes.AccessLevel;
import com.example.classes.ReportAssignment;
import java.time.Instant;

/**
 * One grant on a report, with the person it names.
 *
 * @param reportId the report
 * @param assigneeId the employee id of the person granted access
 * @param accessLevel what they may do
 * @param assignedBy the admin who issued the grant, null when they have since been deleted
 * @param assignedAt when it was issued
 * @param employee the person, or a placeholder when they have been deleted
 */
public record AssigneeResponse(
    String reportId,
    String assigneeId,
    AccessLevel accessLevel,
    String assignedBy,
    Instant assignedAt,
    EmployeeSummary employee
) {

    /**
     * Builds a response from a grant.
     *
     * @param assignment the grant
     * @param employee the person it names
     * @return the response
     */
    public static AssigneeResponse from(ReportAssignment assignment, EmployeeSummary employee) {
        return new AssigneeResponse(
            assignment.reportId(),
            assignment.assigneeId(),
            assignment.accessLevel(),
            assignment.assignedBy(),
            assignment.assignedAt(),
            employee);
    }
}
