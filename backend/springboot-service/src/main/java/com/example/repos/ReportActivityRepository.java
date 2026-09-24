package com.example.repos;

import com.example.classes.ReportActivity;
import java.util.List;

/**
 * Stores the entries in each report's activity thread.
 *
 * Append-only from the API's point of view: entries are written and read back in order, never
 * edited. Deleting a report takes its thread with it, which the database does through a cascading
 * foreign key and the in-memory store does not need to, since tests reset everything together.
 */
public interface ReportActivityRepository {

    /**
     * Adds an entry to a report's thread.
     *
     * @param activity the entry to store
     * @return the stored entry
     */
    ReportActivity append(ReportActivity activity);

    /**
     * Returns a report's thread, oldest first.
     *
     * @param reportId the report
     * @return the entries, empty when there are none
     */
    List<ReportActivity> findByReport(String reportId);

    /**
     * Removes every entry. For resetting state between tests.
     */
    void deleteAll();
}
