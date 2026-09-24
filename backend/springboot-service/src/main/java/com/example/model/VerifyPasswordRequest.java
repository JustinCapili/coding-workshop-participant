package com.example.model;

/**
 * Request body for checking the signed-in employee's current password, the first step of changing
 * it.
 *
 * @param password the password to check
 */
public record VerifyPasswordRequest(
    String password
) {
}
