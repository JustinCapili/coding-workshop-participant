package com.example.classes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNullPointerException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Checks the engineer-first way of reaching the same relationship.
 */
class EngineerTest {

    /** The admin the engineer is assigned to. */
    private FacultyAdmin admin;

    /** The engineer under test. */
    private Engineer engineer;

    @BeforeEach
    void setUp() {
        admin = new FacultyAdmin("admin@example.com", "pw", "FA1");
        engineer = new Engineer("eng@example.com", "pw", "E1");
    }

    @Test
    @DisplayName("assigning from the engineer reaches the same state as adding from the admin")
    void assignToDelegatesToTheOwningSide() {
        engineer.assignTo(admin);

        assertThat(admin.getManagedEngineers()).containsExactly(engineer);
        assertThat(engineer.getFacultyAdmin()).isSameAs(admin);
    }

    @Test
    @DisplayName("unassigning detaches the engineer from their admin")
    void unassignDetaches() {
        engineer.assignTo(admin);

        engineer.unassign();

        assertThat(engineer.getFacultyAdmin()).isNull();
        assertThat(admin.getManagedEngineers()).isEmpty();
    }

    @Test
    @DisplayName("unassigning an unassigned engineer does nothing")
    void unassignWhenUnassignedIsANoOp() {
        engineer.unassign();

        assertThat(engineer.isAssigned()).isFalse();
        assertThat(engineer.getFacultyAdminId()).isNull();
    }

    @Test
    @DisplayName("a new engineer starts out unassigned")
    void newEngineerIsUnassigned() {
        assertThat(engineer.isAssigned()).isFalse();
        assertThat(engineer.getFacultyAdmin()).isNull();
        assertThat(engineer.getFacultyAdminId()).isNull();
    }

    @Test
    @DisplayName("assigning to nothing is rejected")
    void assignToNullIsRejected() {
        assertThatNullPointerException().isThrownBy(() -> engineer.assignTo(null));
    }

    @Test
    @DisplayName("an engineer is an employee and a user")
    void engineerInheritsTheHierarchy() {
        assertThat(engineer).isInstanceOf(Employee.class).isInstanceOf(User.class);
        assertThat(engineer.getEmployeeId()).isEqualTo("E1");
        assertThat(engineer.getEmail()).isEqualTo("eng@example.com");
    }
}
