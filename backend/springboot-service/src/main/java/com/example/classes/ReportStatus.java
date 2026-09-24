package com.example.classes;

import java.util.Arrays;
import java.util.Set;

/**
 * Where a report has reached in its lifecycle.
 *
 * The database records which values are legal, through a CHECK constraint on the status column. It
 * cannot record which *moves* are legal, because a CHECK sees only the row being written and never
 * the value it replaces. That half of the rule lives here.
 *
 * The path forward is UNASSIGNED, ASSIGNED, IN_PROGRESS, SUBMITTED, APPROVED, ARCHIVED. Two moves go
 * backwards, both of them things that genuinely happen: a revoked assignment returns a report to
 * UNASSIGNED, and a reviewer may send a submitted report back for more work.
 *
 * Note that UNASSIGNED and ASSIGNED describe the same fact the report_assignment table records, from
 * the other side. The two can disagree if a grant is issued or revoked without moving the status, so
 * whichever code does one must do the other.
 */
public enum ReportStatus {

    /** Created, but nobody has been put on it yet. The state every report starts in. */
    UNASSIGNED,

    /** Somebody has been assigned, but work has not started. */
    ASSIGNED,

    /** Being worked on by its assignee. */
    IN_PROGRESS,

    /** Finished by its assignee and waiting on review. */
    SUBMITTED,

    /** Accepted by a reviewer. */
    APPROVED,

    /** Closed and kept for the record. The end of the line. */
    ARCHIVED;

    /**
     * Returns the states this one may move to.
     *
     * @return the permitted next states, empty when this state is final
     */
    public Set<ReportStatus> allowedNext() {
        return switch (this) {
            case UNASSIGNED -> Set.of(ASSIGNED);
            // Back to UNASSIGNED when the last assignment is revoked.
            case ASSIGNED -> Set.of(IN_PROGRESS, UNASSIGNED);
            case IN_PROGRESS -> Set.of(SUBMITTED);
            // Back to IN_PROGRESS when a reviewer wants more work.
            case SUBMITTED -> Set.of(APPROVED, IN_PROGRESS);
            case APPROVED -> Set.of(ARCHIVED);
            case ARCHIVED -> Set.of();
        };
    }

    /**
     * Reports whether a move to the given state is permitted from this one.
     *
     * @param next the state being moved to
     * @return true when the move is legal
     */
    public boolean canMoveTo(ReportStatus next) {
        return allowedNext().contains(next);
    }

    /**
     * Reports whether work on this report has not yet started.
     *
     * @return true for the two states that precede any work being done
     */
    public boolean isPreWork() {
        return this == UNASSIGNED || this == ASSIGNED;
    }

    /**
     * Parses a stored or submitted status value.
     *
     * Kept here rather than calling valueOf at each call site, so that an unrecognised value produces
     * a message naming the legal ones instead of a bare IllegalArgumentException.
     *
     * @param value the status name
     * @return the matching status
     * @throws IllegalArgumentException if the value is null or not a known status
     */
    public static ReportStatus of(String value) {
        return Arrays.stream(values())
            .filter(status -> status.name().equalsIgnoreCase(value))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException(
                "Unknown status '" + value + "'; expected one of " + Arrays.toString(values())));
    }
}
