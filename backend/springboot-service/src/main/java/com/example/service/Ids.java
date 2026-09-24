package com.example.service;

import java.security.SecureRandom;
import java.util.HexFormat;

/**
 * Generates the short, prefixed identifiers reports, their records and self-registered employees use.
 *
 * A prefix plus ten random hex digits, such as {@code RPT-3F9A0C71B2}: short enough to read aloud
 * from a card on the dashboard, long enough that a collision is not something this service will see.
 * Callers that key a table on one still check for a clash before inserting.
 */
public final class Ids {

    /** Source of the random part. */
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Upper-case hex, to match the prefix. */
    private static final HexFormat HEX = HexFormat.of().withUpperCase();

    /** Not instantiable. */
    private Ids() {
    }

    /**
     * Returns a fresh identifier.
     *
     * @param prefix the type marker, such as RPT
     * @return the identifier
     */
    public static String next(String prefix) {
        byte[] bytes = new byte[5];
        RANDOM.nextBytes(bytes);
        return prefix + "-" + HEX.formatHex(bytes);
    }
}
