package com.example.classes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Checks that the management link stays consistent in both directions.
 *
 * These are the invariants the whole design rests on: if one of these breaks, an admin and an
 * engineer can disagree about who manages whom, and nothing else in the service would notice.
 */
class FacultyAdminTest {

    /** The admin under test. */
    private FacultyAdmin admin;

    /** A second admin, used to check moving an engineer between admins. */
    private FacultyAdmin otherAdmin;

    /** The engineer being managed. */
    private Engineer engineer;

    @BeforeEach
    void setUp() {
        admin = new FacultyAdmin("admin@example.com", "pw", "FA1");
        otherAdmin = new FacultyAdmin("other@example.com", "pw", "FA2");
        engineer = new Engineer("eng@example.com", "pw", "E1");
    }

    @Test
    @DisplayName("adding an engineer links both sides")
    void addEngineerLinksBothSides() {
        admin.addEngineer(engineer);

        assertThat(admin.getManagedEngineers()).containsExactly(engineer);
        assertThat(admin.managesEngineer(engineer)).isTrue();
        assertThat(engineer.getFacultyAdmin()).isSameAs(admin);
        assertThat(engineer.getFacultyAdminId()).isEqualTo("FA1");
        assertThat(engineer.isAssigned()).isTrue();
    }

    @Test
    @DisplayName("adding the same engineer twice changes nothing")
    void addEngineerIsIdempotent() {
        admin.addEngineer(engineer);
        admin.addEngineer(engineer);

        assertThat(admin.getManagedEngineerCount()).isEqualTo(1);
        assertThat(engineer.getFacultyAdmin()).isSameAs(admin);
    }

    @Test
    @DisplayName("adding an engineer managed elsewhere moves them, leaving no trace behind")
    void addEngineerReparentsFromPreviousAdmin() {
        admin.addEngineer(engineer);
        otherAdmin.addEngineer(engineer);

        assertThat(admin.getManagedEngineers()).isEmpty();
        assertThat(otherAdmin.getManagedEngineers()).containsExactly(engineer);
        assertThat(engineer.getFacultyAdmin()).isSameAs(otherAdmin);
    }

    @Test
    @DisplayName("removing an engineer clears their back-reference")
    void removeEngineerClearsBackReference() {
        admin.addEngineer(engineer);
        admin.removeEngineer(engineer);

        assertThat(admin.getManagedEngineers()).isEmpty();
        assertThat(engineer.getFacultyAdmin()).isNull();
        assertThat(engineer.getFacultyAdminId()).isNull();
        assertThat(engineer.isAssigned()).isFalse();
    }

    @Test
    @DisplayName("one admin cannot release an engineer another admin manages")
    void removeEngineerOfUnmanagedEngineerLeavesTheirAdminAlone() {
        admin.addEngineer(engineer);

        otherAdmin.removeEngineer(engineer);

        assertThat(engineer.getFacultyAdmin()).isSameAs(admin);
        assertThat(admin.getManagedEngineers()).containsExactly(engineer);
    }

    @Test
    @DisplayName("the managed engineer list cannot be modified")
    void getManagedEngineersIsImmutable() {
        admin.addEngineer(engineer);
        List<Engineer> managed = admin.getManagedEngineers();
        Engineer intruder = new Engineer("x@example.com", "pw", "E9");

        assertThatThrownBy(() -> managed.add(intruder))
            .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("an already-returned list does not grow when another engineer is added")
    void getManagedEngineersIsASnapshot() {
        admin.addEngineer(engineer);
        List<Engineer> managed = admin.getManagedEngineers();

        admin.addEngineer(new Engineer("second@example.com", "pw", "E2"));

        assertThat(managed).hasSize(1);
        assertThat(admin.getManagedEngineerCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("null engineers are rejected rather than quietly ignored")
    void nullEngineersAreRejected() {
        assertThatNullPointerException().isThrownBy(() -> admin.addEngineer(null));
        assertThatNullPointerException().isThrownBy(() -> admin.removeEngineer(null));
        assertThat(admin.managesEngineer(null)).isFalse();
    }

    @Test
    @DisplayName("an engineer stays findable after their email changes")
    void engineerSurvivesAMutableFieldChange() {
        admin.addEngineer(engineer);

        engineer.setEmail("renamed@example.com");

        // Fails the moment someone gives these classes a hashCode built on a mutable field: the
        // engineer would still be in the backing set but filed under a hash that no longer matches.
        assertThat(admin.managesEngineer(engineer)).isTrue();
        admin.removeEngineer(engineer);
        assertThat(admin.getManagedEngineers()).isEmpty();
    }
}
