package com.example.classes;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Checks that access levels compare in the intended order.
 *
 * The comparison is by ordinal, so these tests are really guarding the declaration order. Inserting a
 * new level in the wrong place would silently change the answer to every permission question in the
 * service, without breaking anything that would look like a compile error.
 */
class AccessLevelTest {

    @Test
    @DisplayName("levels are declared weakest to strongest")
    void ordering() {
        assertThat(AccessLevel.values()).containsExactly(
            AccessLevel.NONE,
            AccessLevel.VIEWER,
            AccessLevel.CONTRIBUTOR,
            AccessLevel.MANAGER,
            AccessLevel.ADMIN);
    }

    @ParameterizedTest
    @EnumSource(AccessLevel.class)
    @DisplayName("every level satisfies a requirement for itself")
    void reflexive(AccessLevel level) {
        assertThat(level.atLeast(level)).isTrue();
    }

    @Test
    @DisplayName("a stronger level satisfies a weaker requirement")
    void strongerSatisfiesWeaker() {
        assertThat(AccessLevel.MANAGER.atLeast(AccessLevel.CONTRIBUTOR)).isTrue();
        assertThat(AccessLevel.ADMIN.atLeast(AccessLevel.VIEWER)).isTrue();
        assertThat(AccessLevel.CONTRIBUTOR.atLeast(AccessLevel.VIEWER)).isTrue();
    }

    @Test
    @DisplayName("a weaker level does not satisfy a stronger requirement")
    void weakerDoesNotSatisfyStronger() {
        assertThat(AccessLevel.VIEWER.atLeast(AccessLevel.CONTRIBUTOR)).isFalse();
        assertThat(AccessLevel.CONTRIBUTOR.atLeast(AccessLevel.MANAGER)).isFalse();
        assertThat(AccessLevel.MANAGER.atLeast(AccessLevel.ADMIN)).isFalse();
    }

    @Test
    @DisplayName("NONE satisfies nothing that requires access")
    void noneSatisfiesNothing() {
        assertThat(AccessLevel.NONE.atLeast(AccessLevel.VIEWER)).isFalse();
        assertThat(AccessLevel.NONE.atLeast(AccessLevel.MANAGER)).isFalse();
        assertThat(AccessLevel.NONE.atLeast(AccessLevel.ADMIN)).isFalse();
    }

    @Test
    @DisplayName("MANAGER is the strongest level a grant may carry")
    void managerIsTheCeilingForAGrant() {
        // The CHECK constraint on report_assignment permits only VIEWER, CONTRIBUTOR and MANAGER.
        // ADMIN is excluded there because admin rights come from being a faculty admin rather than
        // from a grant, so no grant should be able to satisfy a requirement of ADMIN.
        assertThat(AccessLevel.MANAGER.atLeast(AccessLevel.ADMIN)).isFalse();
    }
}
