package com.example.repos;

import com.example.classes.FacultyAdmin;

/**
 * Stores faculty admins, keyed by employee id.
 *
 * An interface for the same reason as {@link EngineerRepository}: the implementation is selected by
 * profile, and nothing above this layer knows which one is in use.
 *
 * Every admin returned from here arrives with its managed engineers already attached, so callers can
 * read {@code getManagedEngineers()} without issuing a second lookup of their own.
 */
public interface FacultyAdminRepository extends Repository<FacultyAdmin> {
}
