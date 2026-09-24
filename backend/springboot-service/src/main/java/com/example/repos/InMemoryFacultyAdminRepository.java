package com.example.repos;

import com.example.classes.FacultyAdmin;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;

/**
 * Keeps faculty admins in a map, for tests and for running without a database.
 *
 * Active only under the test profile, exactly as {@link InMemoryEngineerRepository} is.
 *
 * Note one difference from the JDBC implementation: here an admin and its engineers are the same
 * objects the caller handed in, so the managed set is always whatever the domain last did to it.
 * Against a database the graph is rebuilt from rows on every read instead.
 */
@Repository
@Profile("test")
public class InMemoryFacultyAdminRepository
    extends InMemoryRepository<FacultyAdmin>
    implements FacultyAdminRepository {

    @Override
    protected String idOf(FacultyAdmin facultyAdmin) {
        return facultyAdmin.getEmployeeId();
    }
}
