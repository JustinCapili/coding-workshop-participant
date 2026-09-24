package com.example.auth;

/**
 * The caller has not proved who they are: no token, an expired one, or one for somebody who no
 * longer exists. Answered with 401.
 */
public class UnauthorizedException extends RuntimeException {

    /**
     * Creates the exception.
     *
     * @param message what was wrong with the credentials, phrased for the caller
     */
    public UnauthorizedException(String message) {
        super(message);
    }
}
