package com.example.model;

import java.util.List;

/**
 * A faculty admin's approval queue.
 *
 * @param assignmentRequests engineers waiting to be put on reports
 * @param closeRequests authors waiting for their reports to be closed
 */
public record PendingRequestsResponse(
    List<AssignmentRequestResponse> assignmentRequests,
    List<CloseRequestResponse> closeRequests
) {
}
