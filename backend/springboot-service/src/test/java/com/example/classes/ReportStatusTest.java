package com.example.classes;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

/**
 * Checks the lifecycle rules the database cannot express.
 *
 * A CHECK constraint pins the set of legal status values; only this enum decides which moves between
 * them are allowed, so these are the tests guarding that half.
 */
class ReportStatusTest {

    @ParameterizedTest
    @CsvSource({
        "UNASSIGNED,  ASSIGNED",
        "ASSIGNED,    IN_PROGRESS",
        "ASSIGNED,    UNASSIGNED",
        "IN_PROGRESS, SUBMITTED",
        "SUBMITTED,   APPROVED",
        "SUBMITTED,   IN_PROGRESS",
        "APPROVED,    ARCHIVED"
    })
    @DisplayName("the permitted moves are permitted")
    void permittedMoves(ReportStatus from, ReportStatus to) {
        assertThat(from.canMoveTo(to)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
        // No skipping review.
        "UNASSIGNED,  IN_PROGRESS",
        "UNASSIGNED,  APPROVED",
        "ASSIGNED,    SUBMITTED",
        "IN_PROGRESS, APPROVED",
        "IN_PROGRESS, ARCHIVED",
        // No approving without submission, and no unapproving.
        "SUBMITTED,   ARCHIVED",
        "APPROVED,    SUBMITTED",
        // Archived is the end.
        "ARCHIVED,    APPROVED",
        "ARCHIVED,    IN_PROGRESS"
    })
    @DisplayName("moves that would skip or reverse the lifecycle are refused")
    void refusedMoves(ReportStatus from, ReportStatus to) {
        assertThat(from.canMoveTo(to)).isFalse();
    }

    @ParameterizedTest
    @EnumSource(ReportStatus.class)
    @DisplayName("no status may move to itself")
    void noSelfMoves(ReportStatus status) {
        assertThat(status.canMoveTo(status)).isFalse();
    }

    @Test
    @DisplayName("archived is final")
    void archivedIsTerminal() {
        assertThat(ReportStatus.ARCHIVED.allowedNext()).isEmpty();
    }

    @Test
    @DisplayName("every status except archived can still go somewhere")
    void everyOtherStatusHasSomewhereToGo() {
        for (ReportStatus status : ReportStatus.values()) {
            if (status != ReportStatus.ARCHIVED) {
                assertThat(status.allowedNext())
                    .as("%s should have a next state", status)
                    .isNotEmpty();
            }
        }
    }

    @Test
    @DisplayName("statuses parse case-insensitively and name the legal values when they do not")
    void parsing() {
        assertThat(ReportStatus.of("in_progress")).isEqualTo(ReportStatus.IN_PROGRESS);
        assertThat(ReportStatus.of("SUBMITTED")).isEqualTo(ReportStatus.SUBMITTED);

        assertThatThrownBy(() -> ReportStatus.of("PENDING"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("PENDING")
            .hasMessageContaining("UNASSIGNED");
    }

    @Test
    @DisplayName("work has not started while a report is unassigned or merely assigned")
    void preWork() {
        assertThat(ReportStatus.UNASSIGNED.isPreWork()).isTrue();
        assertThat(ReportStatus.ASSIGNED.isPreWork()).isTrue();
        assertThat(ReportStatus.IN_PROGRESS.isPreWork()).isFalse();
    }
}
