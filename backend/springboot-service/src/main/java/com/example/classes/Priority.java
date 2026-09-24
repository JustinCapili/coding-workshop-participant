package com.example.classes;

import java.util.Arrays;

/**
 * How urgently a report needs attention, as judged by whoever filed it.
 *
 * Mirrors PRIORITIES in the frontend's domain/incidentOptions.js and the CHECK on report.priority;
 * the three must change together.
 */
public enum Priority {

    LOW,

    MEDIUM,

    HIGH,

    CRITICAL;

    /**
     * Parses a stored or submitted value, ignoring case.
     *
     * @param value the priority name, may be null or blank
     * @return the matching priority, or null when no value was given
     * @throws IllegalArgumentException if a value was given and is not a known priority
     */
    public static Priority of(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Arrays.stream(values())
            .filter(priority -> priority.name().equalsIgnoreCase(value.trim()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException(
                "Unknown priority '" + value + "'; expected one of " + Arrays.toString(values())));
    }
}
