package com.example.repos;

import com.example.classes.Report;
import java.util.List;

/**
 * Stores reports, keyed by report id.
 *
 * An interface for the same reason as {@link EngineerRepository}: the implementation is chosen by
 * profile, JDBC normally and in-memory under test, and nothing above this layer knows which.
 */
public interface ReportRepository extends Repository<Report> {

    /**
     * Returns the reports filed at a given location.
     *
     * Present because location is the one field the API filters on. Everything else a caller might
     * want to narrow by is cheap enough to do over {@link #findAll()} at this size.
     *
     * @param location the location to match, compared exactly
     * @return the matching reports, empty when none match or location is null
     */
    List<Report> findByLocation(String location);
}
