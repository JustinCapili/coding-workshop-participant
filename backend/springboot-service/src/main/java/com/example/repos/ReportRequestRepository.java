package com.example.repos;

import com.example.classes.ReportRequest;
import java.util.List;
import java.util.Optional;

/**
 * Stores the requests a faculty admin has been asked to confirm.
 *
 * Both request kinds share one store, because a faculty admin reviews them from a single queue and
 * the only difference between them is what approval does.
 */
public interface ReportRequestRepository {

    /**
     * Inserts a request, or replaces the one already holding that id.
     *
     * Replacing is how a request is resolved: the pending value is read, resolved into a new value,
     * and stored back under the same id.
     *
     * @param request the request to store
     * @return the stored request
     */
    ReportRequest save(ReportRequest request);

    /**
     * Looks up one request.
     *
     * @param requestId the identifier
     * @return the request, or empty when none has that id
     */
    Optional<ReportRequest> findById(String requestId);

    /**
     * Returns every request raised on a report, oldest first.
     *
     * @param reportId the report
     * @return the requests, empty when none
     */
    List<ReportRequest> findByReport(String reportId);

    /**
     * Returns every request, oldest first.
     *
     * @return all requests
     */
    List<ReportRequest> findAll();

    /**
     * Removes every request. For resetting state between tests.
     */
    void deleteAll();
}
