package com.example.model;

/**
 * Request body for the signed-in employee changing their own password.
 *
 * @param currentPassword the password they have now, checked again even after a verify step
 * @param newPassword the password to replace it with
 */
public record ChangePasswordRequest(
    String currentPassword,
    String newPassword
) {
}
