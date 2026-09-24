package com.example.model;

/**
 * Request body for adding a comment to a report's thread.
 *
 * @param body the comment text, required
 */
public record CommentRequest(
    String body
) {
}
