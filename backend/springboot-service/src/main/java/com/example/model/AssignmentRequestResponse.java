package com.example.model;

import com.example.classes.ReportRequest;
import com.example.classes.RequestStatus;
import java.time.Instant;

/**
 * An engineer's request to be put on a report.
 *
 * @param requestId the identifier
 * @param reportId the report
 * @param engineerId the engineer asking
 * @param requestedAt when they asked
 * @param status where the request has reached
 * @param engineer the engineer, or a placeholder when they have been deleted
 * @param report the report, included in the approval queue and omitted when nested in one
 */
public record AssignmentRequestResponse(
    String requestId,
    String reportId,
    String engineerId,
    Instant requestedAt,
    RequestStatus status,
    EmployeeSummary engineer,
    ReportResponse report
) {

    /**
     * Builds a response from a request.
     *
     * @param request the request, which must be of type ASSIGNMENT
     * @param engineer the engineer who asked
     * @param report the report, or null to omit it
     * @return the response
     */
    public static AssignmentRequestResponse from(
        ReportRequest request,
        EmployeeSummary engineer,
        ReportResponse report
    ) {
        return new AssignmentRequestResponse(
            request.requestId(),
            request.reportId(),
            request.requestedBy(),
            request.requestedAt(),
            request.status(),
            engineer,
            report);
    }
}
