package com.example.classes;

import java.time.Instant;
import java.util.Objects;

/**
 * A report somebody files, and that a faculty admin assigns people to work on.
 *
 * Who may do what to a report is not recorded here. A faculty admin may do anything to any report,
 * and an engineer's rights come from a {@link ReportAssignment} naming them. Keeping that out of this
 * class means a report carries no stale copy of anybody's permissions.
 *
 * The identifier, author and creation time are fixed at construction. Everything else is editable,
 * which is what the update endpoint exists to do.
 */
public class Report {

    /** Immutable identifier, and the primary key. */
    private final String reportId;

    /** Who filed it. Null once that employee has been deleted; this is provenance, not permission. */
    private final String authorId;

    /** When it was filed. */
    private final Instant createdAt;

    /** Short description of the report. */
    private String title;

    /** The body of the report. May be empty while it is still being written. */
    private String body;

    /** Where the report applies. Free text, and required. */
    private String location;

    /** Where the report has reached in its lifecycle. */
    private ReportStatus status;

    /** When it was last modified. */
    private Instant updatedAt;

    /** What kind of problem it is. Null when the filer did not say. */
    private IncidentType incidentType;

    /** How urgent the filer judged it. Null when the filer did not say. */
    private Priority priority;

    /**
     * Creates a report in full, as when rebuilding one from a stored row.
     *
     * @param reportId the identifier, unique across all reports
     * @param title a short description, required
     * @param body the body text, empty when not yet written
     * @param location where the report applies, required
     * @param status the lifecycle state
     * @param authorId the employee id of whoever filed it, null when that employee is gone
     * @param createdAt when it was filed
     * @param updatedAt when it was last modified
     */
    public Report(
        String reportId,
        String title,
        String body,
        String location,
        ReportStatus status,
        String authorId,
        Instant createdAt,
        Instant updatedAt
    ) {
        this.reportId = reportId;
        this.title = title;
        this.body = body;
        this.location = location;
        this.status = status;
        this.authorId = authorId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    /**
     * Creates a new report, unassigned and timestamped now.
     *
     * @param reportId the identifier, unique across all reports
     * @param title a short description, required
     * @param body the body text, empty when not yet written
     * @param location where the report applies, required
     * @param authorId the employee id of whoever filed it
     */
    public Report(String reportId, String title, String body, String location, String authorId) {
        this(reportId, title, body, location, ReportStatus.UNASSIGNED, authorId,
            Instant.now(), Instant.now());
    }

    /**
     * Sets what kind of problem this is and how urgent it is.
     *
     * Leaves updatedAt alone: this is part of filing the report, or of rebuilding it from a row, not
     * a change to it.
     *
     * @param incidentType the kind of problem, or null
     * @param priority the urgency, or null
     * @return this report
     */
    public Report classify(IncidentType incidentType, Priority priority) {
        this.incidentType = incidentType;
        this.priority = priority;
        return this;
    }

    /**
     * Returns what kind of problem this is.
     *
     * @return the incident type, or null when not given
     */
    public IncidentType getIncidentType() {
        return incidentType;
    }

    /**
     * Returns how urgent this is.
     *
     * @return the priority, or null when not given
     */
    public Priority getPriority() {
        return priority;
    }

    /**
     * Returns the identifier.
     *
     * @return the report id
     */
    public String getReportId() {
        return reportId;
    }

    /**
     * Returns the employee id of whoever filed this report.
     *
     * @return the author's employee id, or null once that employee has been deleted
     */
    public String getAuthorId() {
        return authorId;
    }

    /**
     * Returns when the report was filed.
     *
     * @return the creation time
     */
    public Instant getCreatedAt() {
        return createdAt;
    }

    /**
     * Returns when the report was last modified.
     *
     * @return the last modification time
     */
    public Instant getUpdatedAt() {
        return updatedAt;
    }

    /**
     * Returns the short description.
     *
     * @return the title
     */
    public String getTitle() {
        return title;
    }

    /**
     * Updates the short description.
     *
     * @param title the new title
     */
    public void setTitle(String title) {
        this.title = title;
        touch();
    }

    /**
     * Returns the body text.
     *
     * @return the body, possibly empty
     */
    public String getBody() {
        return body;
    }

    /**
     * Updates the body text.
     *
     * @param body the new body
     */
    public void setBody(String body) {
        this.body = body;
        touch();
    }

    /**
     * Returns where the report applies.
     *
     * @return the location
     */
    public String getLocation() {
        return location;
    }

    /**
     * Updates where the report applies.
     *
     * @param location the new location
     */
    public void setLocation(String location) {
        this.location = location;
        touch();
    }

    /**
     * Returns the lifecycle state.
     *
     * @return the current status
     */
    public ReportStatus getStatus() {
        return status;
    }

    /**
     * Moves the report to a new lifecycle state.
     *
     * Only the moves {@link ReportStatus#allowedNext()} permits are accepted, so a report cannot skip
     * review or come back from being archived.
     *
     * @param next the state to move to
     * @throws IllegalArgumentException if the move is not permitted from the current state
     */
    public void moveTo(ReportStatus next) {
        Objects.requireNonNull(next, "next must not be null");
        if (!status.canMoveTo(next)) {
            throw new IllegalArgumentException(
                "Cannot move report %s from %s to %s; allowed: %s"
                    .formatted(reportId, status, next, status.allowedNext()));
        }
        this.status = next;
        touch();
    }

    /**
     * Records that the report has just changed.
     */
    private void touch() {
        this.updatedAt = Instant.now();
    }

    /**
     * Two reports are the same when they share an identifier.
     *
     * Same reasoning as {@link Employee}: rows read back from the database produce fresh objects, so
     * comparing by identity would treat one report loaded twice as two different reports.
     *
     * @param other the object to compare with
     * @return true when other is a report with the same id
     */
    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (other == null || getClass() != other.getClass()) {
            return false;
        }
        return reportId.equals(((Report) other).reportId);
    }

    /**
     * Hashes on the identifier, which is final and therefore safe to hash on.
     *
     * @return a hash code derived from the report id
     */
    @Override
    public int hashCode() {
        return reportId.hashCode();
    }
}
