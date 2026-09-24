package com.example.repos;

import com.example.classes.ReportAssignment;
import java.util.List;
import java.util.Optional;

/**
 * Stores who has been granted access to which report.
 *
 * Deliberately not a {@link Repository}: that interface keys everything on a single string id, and a
 * grant is identified by a report and a person together. Forcing it into that shape would mean
 * inventing a composite key format and parsing it back out at every call site.
 */
public interface ReportAssignmentRepository {

    /**
     * Issues a grant, replacing any the same person already holds on the same report.
     *
     * Replacing rather than rejecting is what makes raising or lowering somebody's level a single
     * call, and it matches the one-grant-per-person-per-report rule the database enforces.
     *
     * @param assignment the grant to store
     * @return the stored grant
     */
    ReportAssignment grant(ReportAssignment assignment);

    /**
     * Looks up one person's grant on one report.
     *
     * This is the question asked on every write to a report, so it is the one worth being fast.
     *
     * @param reportId the report
     * @param assigneeId the employee id of the person
     * @return the grant, or empty when that person holds none on that report
     */
    Optional<ReportAssignment> find(String reportId, String assigneeId);

    /**
     * Returns every grant issued on a report.
     *
     * @param reportId the report
     * @return the grants, empty when nobody is assigned
     */
    List<ReportAssignment> findByReport(String reportId);

    /**
     * Returns every grant held by one person.
     *
     * @param assigneeId the employee id of the person
     * @return their grants, empty when they hold none
     */
    List<ReportAssignment> findByAssignee(String assigneeId);

    /**
     * Withdraws a grant.
     *
     * @param reportId the report
     * @param assigneeId the employee id of the person losing access
     * @return true when a grant was withdrawn, false when there was none to withdraw
     */
    boolean revoke(String reportId, String assigneeId);

    /**
     * Removes every grant.
     *
     * Present so tests can reset state between methods, exactly as {@link Repository#deleteAll()} is.
     */
    void deleteAll();
}
