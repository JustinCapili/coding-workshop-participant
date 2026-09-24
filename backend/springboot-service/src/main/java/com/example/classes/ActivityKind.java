package com.example.classes;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;

/**
 * What one entry in a report's activity thread records.
 *
 * Serialised in lower case because the thread is rendered as a GitHub-style feed and the client
 * keys its rendering on these values.
 */
public enum ActivityKind {

    /** Free text written by a person. */
    COMMENT,

    /** A lifecycle move, with the body naming the from and to states. */
    STATUS,

    /** Somebody was assigned or unassigned. */
    ASSIGNMENT,

    /** A request was raised, approved or declined. */
    REQUEST;

    /**
     * Returns the wire form of this kind.
     *
     * @return the name in lower case
     */
    @JsonValue
    public String json() {
        return name().toLowerCase();
    }

    /**
     * Parses a stored or submitted kind, in either case.
     *
     * @param value the kind name
     * @return the matching kind
     * @throws IllegalArgumentException if the value is not a known kind
     */
    @JsonCreator
    public static ActivityKind of(String value) {
        return Arrays.stream(values())
            .filter(kind -> kind.name().equalsIgnoreCase(value))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException(
                "Unknown activity kind '" + value + "'; expected one of " + Arrays.toString(values())));
    }
}
