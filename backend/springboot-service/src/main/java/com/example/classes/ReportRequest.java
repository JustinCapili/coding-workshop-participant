package com.example.classes;

import java.time.Instant;

/**
 * Something a faculty admin has been asked to confirm about a report.
 *
 * Both kinds of request share this shape: who asked, when, and what was decided. Resolving one
 * produces a new value rather than mutating this one, so a request that was PENDING when it was read
 * stays PENDING in the caller's hands until they store the resolved copy.
 *
 * @param requestId the identifier
 * @param reportId the report the request concerns
 * @param type what is being asked
 * @param requestedBy the employee id of whoever asked
 * @param requestedAt when they asked
 * @param status where the request has reached
 * @param resolvedBy the faculty admin who decided, null while pending or once deleted
 * @param resolvedAt when it was decided, null while pending
 */
public record ReportRequest(
    String requestId,
    String reportId,
    RequestType type,
    String requestedBy,
    Instant requestedAt,
    RequestStatus status,
    String resolvedBy,
    Instant resolvedAt
) {

    /**
     * Creates a pending request raised now.
     *
     * @param requestId the identifier
     * @param reportId the report the request concerns
     * @param type what is being asked
     * @param requestedBy the employee id of whoever is asking
     * @return the pending request
     */
    public static ReportRequest pending(
        String requestId,
        String reportId,
        RequestType type,
        String requestedBy
    ) {
        return new ReportRequest(
            requestId, reportId, type, requestedBy, Instant.now(), RequestStatus.PENDING, null, null);
    }

    /**
     * Reports whether this request is still waiting on a decision.
     *
     * @return true while pending
     */
    public boolean isPending() {
        return status == RequestStatus.PENDING;
    }

    /**
     * Returns a copy of this request decided now by the given faculty admin.
     *
     * @param outcome APPROVED or DECLINED
     * @param facultyAdminId the deciding admin's employee id
     * @return the resolved request
     * @throws IllegalStateException if this request has already been decided
     * @throws IllegalArgumentException if the outcome is PENDING
     */
    public ReportRequest resolve(RequestStatus outcome, String facultyAdminId) {
        if (!isPending()) {
            throw new IllegalStateException("Request " + requestId + " is already " + status);
        }
        if (outcome == RequestStatus.PENDING) {
            throw new IllegalArgumentException("A request cannot be resolved to PENDING");
        }
        return new ReportRequest(
            requestId, reportId, type, requestedBy, requestedAt, outcome, facultyAdminId,
            Instant.now());
    }
}
