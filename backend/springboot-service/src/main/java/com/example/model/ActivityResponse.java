package com.example.model;

import com.example.classes.ActivityKind;
import com.example.classes.ReportActivity;
import java.time.Instant;

/**
 * One entry in a report's thread, with its author.
 *
 * @param activityId the identifier
 * @param reportId the report
 * @param kind what the entry records
 * @param authorId who wrote it, null once they have been deleted
 * @param body the text
 * @param createdAt when it was written
 * @param author the author, or a placeholder when they have been deleted
 */
public record ActivityResponse(
    String activityId,
    String reportId,
    ActivityKind kind,
    String authorId,
    String body,
    Instant createdAt,
    EmployeeSummary author
) {

    /**
     * Builds a response from an entry.
     *
     * @param activity the entry
     * @param author its author
     * @return the response
     */
    public static ActivityResponse from(ReportActivity activity, EmployeeSummary author) {
        return new ActivityResponse(
            activity.activityId(),
            activity.reportId(),
            activity.kind(),
            activity.authorId(),
            activity.body(),
            activity.createdAt(),
            author);
    }
}
