package com.example.classes;

import java.time.Instant;

/**
 * One entry in a report's activity thread: a comment, or a system event rendered alongside them.
 *
 * A record because an entry is never edited once written; correcting one means adding another.
 *
 * @param activityId the identifier
 * @param reportId the report the entry belongs to
 * @param kind what the entry records
 * @param authorId who wrote it or caused it, null once that employee has been deleted
 * @param body the text: a comment, or a short description of the event
 * @param createdAt when it was written
 */
public record ReportActivity(
    String activityId,
    String reportId,
    ActivityKind kind,
    String authorId,
    String body,
    Instant createdAt
) {
}
