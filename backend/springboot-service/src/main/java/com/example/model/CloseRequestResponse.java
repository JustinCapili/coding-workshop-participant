package com.example.model;

import com.example.classes.ReportRequest;
import com.example.classes.RequestStatus;
import java.time.Instant;

/**
 * An author's request to have their report closed.
 *
 * @param requestId the identifier
 * @param reportId the report
 * @param requestedBy who asked
 * @param requestedAt when they asked
 * @param status where the request has reached
 * @param requester the person, or a placeholder when they have been deleted
 * @param report the report, included in the approval queue and omitted when nested in one
 */
public record CloseRequestResponse(
    String requestId,
    String reportId,
    String requestedBy,
    Instant requestedAt,
    RequestStatus status,
    EmployeeSummary requester,
    ReportResponse report
) {

    /**
     * Builds a response from a request.
     *
     * @param request the request, which must be of type CLOSE
     * @param requester who asked
     * @param report the report, or null to omit it
     * @return the response
     */
    public static CloseRequestResponse from(
        ReportRequest request,
        EmployeeSummary requester,
        ReportResponse report
    ) {
        return new CloseRequestResponse(
            request.requestId(),
            request.reportId(),
            request.requestedBy(),
            request.requestedAt(),
            request.status(),
            requester,
            report);
    }
}
