package com.example.classes;

import java.time.Instant;

/**
 * A grant: one person's access to one report.
 *
 * This is the whole of an engineer's authority over a report. A faculty admin needs no grant, holding
 * {@link AccessLevel#ADMIN} over everything by virtue of their role, which is why ADMIN can never
 * appear as the level here — a grant that could confer admin rights would let its holder issue
 * further grants.
 *
 * A record rather than a class because a grant is a value: changing somebody's level means replacing
 * the row, not mutating it, so there is nothing here worth a setter.
 *
 * @param reportId the report the grant applies to
 * @param assigneeId the employee id of the person granted access
 * @param accessLevel what they may do to that report
 * @param assignedBy the faculty admin who issued the grant, null when it came from authorship or
 *     when that employee has since been deleted
 * @param assignedAt when the grant was issued
 */
public record ReportAssignment(
    String reportId,
    String assigneeId,
    AccessLevel accessLevel,
    String assignedBy,
    Instant assignedAt
) {

    /**
     * Creates a grant issued now by a faculty admin.
     *
     * @param reportId the report the grant applies to
     * @param assigneeId the employee id of the person being granted access
     * @param accessLevel what they may do to that report
     * @param assignedBy the faculty admin issuing it
     * @return the grant
     */
    public static ReportAssignment issued(
        String reportId,
        String assigneeId,
        AccessLevel accessLevel,
        String assignedBy
    ) {
        return new ReportAssignment(reportId, assigneeId, accessLevel, assignedBy, Instant.now());
    }

    /**
     * Creates the grant an author holds over their own report.
     *
     * Nobody issued it, so there is no assigner to record. That is also what keeps the database's
     * no-self-grant constraint satisfied, since it compares the assignee against a null.
     *
     * @param reportId the report that was authored
     * @param authorId the employee id of the author
     * @return the grant
     */
    public static ReportAssignment forAuthor(String reportId, String authorId) {
        return new ReportAssignment(
            reportId, authorId, AccessLevel.CONTRIBUTOR, null, Instant.now());
    }
}
