package com.example.classes;

import java.util.Arrays;

/**
 * Where a {@link ReportRequest} has reached. PENDING until a faculty admin decides.
 */
public enum RequestStatus {

    /** Waiting on a faculty admin. */
    PENDING,

    /** Granted. */
    APPROVED,

    /** Refused. */
    DECLINED;

    /**
     * Parses a submitted status value.
     *
     * @param value the status name
     * @return the matching status
     * @throws IllegalArgumentException if the value is null or not a known status
     */
    public static RequestStatus of(String value) {
        return Arrays.stream(values())
            .filter(status -> status.name().equalsIgnoreCase(value))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException(
                "Unknown request status '" + value + "'; expected one of "
                    + Arrays.toString(values())));
    }
}
