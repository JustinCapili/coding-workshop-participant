package com.example.model;

import java.time.Instant;

/**
 * What a successful sign-in, or a refresh, returns.
 *
 * @param token the JWT to send as {@code Authorization: Bearer <token>} on later requests
 * @param expiresAt when the token stops working; call {@code POST /auth/refresh} before then
 * @param user who signed in
 */
public record LoginResponse(
    String token,
    Instant expiresAt,
    EmployeeSummary user
) {
}
