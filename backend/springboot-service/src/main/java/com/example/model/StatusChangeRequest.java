package com.example.model;

/**
 * Request body for moving a report to a new lifecycle state.
 *
 * @param status the state to move to, one of the {@code ReportStatus} names
 */
public record StatusChangeRequest(
    String status
) {
}
