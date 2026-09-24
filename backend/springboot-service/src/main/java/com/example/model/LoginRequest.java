package com.example.model;

/**
 * Request body for signing in.
 *
 * @param email the employee's email address, compared ignoring case
 * @param password the employee's password
 */
public record LoginRequest(
    String email,
    String password
) {
}
