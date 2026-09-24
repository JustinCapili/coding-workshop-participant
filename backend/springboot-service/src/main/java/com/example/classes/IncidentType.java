package com.example.classes;

import java.util.Arrays;

/**
 * What kind of problem a report describes.
 *
 * Mirrors INCIDENT_TYPES in the frontend's domain/incidentOptions.js and the CHECK on
 * report.incident_type; the three must change together.
 */
public enum IncidentType {

    /** Buildings, rooms, plumbing, heating. */
    FACILITIES,

    /** Computers, networks, accounts. */
    IT,

    /** Anything putting people at risk. */
    SAFETY,

    /** Anything else. */
    OTHER;

    /**
     * Parses a stored or submitted value, ignoring case.
     *
     * @param value the type name, may be null or blank
     * @return the matching type, or null when no value was given
     * @throws IllegalArgumentException if a value was given and is not a known type
     */
    public static IncidentType of(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Arrays.stream(values())
            .filter(type -> type.name().equalsIgnoreCase(value.trim()))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException(
                "Unknown incidentType '" + value + "'; expected one of " + Arrays.toString(values())));
    }
}
