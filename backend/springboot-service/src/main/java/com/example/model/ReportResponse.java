package com.example.model;

import com.example.classes.IncidentType;
import com.example.classes.Priority;
import com.example.classes.Report;
import com.example.classes.ReportStatus;
import java.time.Instant;
import java.util.List;

/**
 * A report as returned by the API, with the people on it and anything awaiting a decision.
 *
 * The thread is only filled in for a single report; a listing leaves it null, and the Jackson
 * inclusion setting then omits it rather than sending an empty array that means something different.
 *
 * @param reportId the identifier
 * @param title the short description
 * @param body the full text
 * @param location where the problem is
 * @param status where the report has reached
 * @param incidentType what kind of problem it is, null (so omitted) when not given
 * @param priority how urgent it is, null (so omitted) when not given
 * @param authorId who filed it, null once they have been deleted
 * @param author the author, or a placeholder when they have been deleted
 * @param createdAt when it was filed
 * @param updatedAt when it last changed
 * @param assignees everyone granted access, empty when nobody is assigned
 * @param pendingAssignmentRequests engineers waiting to be put on it
 * @param pendingCloseRequest the author's open request to close it, null when there is none
 * @param activity the thread, oldest first; null in listings
 */
public record ReportResponse(
    String reportId,
    String title,
    String body,
    String location,
    ReportStatus status,
    IncidentType incidentType,
    Priority priority,
    String authorId,
    EmployeeSummary author,
    Instant createdAt,
    Instant updatedAt,
    List<AssigneeResponse> assignees,
    List<AssignmentRequestResponse> pendingAssignmentRequests,
    CloseRequestResponse pendingCloseRequest,
    List<ActivityResponse> activity
) {

    /**
     * Builds a response without a thread.
     *
     * @param report the report
     * @param author the author
     * @param assignees the grants on it
     * @param pendingAssignmentRequests engineers waiting to be put on it
     * @param pendingCloseRequest the open close request, or null
     * @return the response
     */
    public static ReportResponse from(
        Report report,
        EmployeeSummary author,
        List<AssigneeResponse> assignees,
        List<AssignmentRequestResponse> pendingAssignmentRequests,
        CloseRequestResponse pendingCloseRequest
    ) {
        return new ReportResponse(
            report.getReportId(),
            report.getTitle(),
            report.getBody(),
            report.getLocation(),
            report.getStatus(),
            report.getIncidentType(),
            report.getPriority(),
            report.getAuthorId(),
            author,
            report.getCreatedAt(),
            report.getUpdatedAt(),
            assignees,
            pendingAssignmentRequests,
            pendingCloseRequest,
            null);
    }

    /**
     * Returns a copy of this response carrying the given thread.
     *
     * @param thread the entries, oldest first
     * @return the response with its thread filled in
     */
    public ReportResponse withActivity(List<ActivityResponse> thread) {
        return new ReportResponse(
            reportId, title, body, location, status, incidentType, priority, authorId, author,
            createdAt, updatedAt,
            assignees, pendingAssignmentRequests, pendingCloseRequest, thread);
    }
}
