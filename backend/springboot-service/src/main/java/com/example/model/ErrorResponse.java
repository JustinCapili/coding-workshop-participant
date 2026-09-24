package com.example.model;

/**
 * The body returned for any request that fails.
 *
 * @param status the HTTP status code
 * @param error the short reason phrase for that status, such as "Not Found"
 * @param message what went wrong, phrased for the caller rather than for a log file
 */
public record ErrorResponse(
    int status,
    String error,
    String message
) {
}
