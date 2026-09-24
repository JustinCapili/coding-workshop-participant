package com.example.auth;

/**
 * The caller is known but may not do this. Answered with 403.
 */
public class ForbiddenException extends RuntimeException {

    /**
     * Creates the exception.
     *
     * @param message what the caller is not allowed to do
     */
    public ForbiddenException(String message) {
        super(message);
    }
}
