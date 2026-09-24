package com.example.controller;

import com.example.auth.ForbiddenException;
import com.example.auth.UnauthorizedException;
import com.example.model.ErrorResponse;
import java.util.NoSuchElementException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

/**
 * Turns exceptions thrown by the controllers into error responses.
 *
 * The mapping is deliberately plain: a missing thing is a 404, a malformed request is a 400, and a
 * request that conflicts with the current state of the world is a 409. Controllers throw the matching
 * standard exception and say nothing about status codes.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** Logger for failures that are not the caller's fault. */
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * Handles a request for something that does not exist.
     *
     * @param exception the exception describing what was not found
     * @return a 404 response
     */
    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(NoSuchElementException exception) {
        return build(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    /**
     * Handles a request to a path no controller is mapped on.
     *
     * @param exception the exception naming the unmapped path
     * @return a 404 response
     */
    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoHandler(NoHandlerFoundException exception) {
        return build(HttpStatus.NOT_FOUND, "No endpoint " + exception.getRequestURL());
    }

    /**
     * Handles a request without usable credentials.
     *
     * Carries the {@code WWW-Authenticate} header RFC 7235 requires on a 401, naming the Bearer
     * scheme so a generic client knows what kind of credential to send.
     *
     * @param exception the exception describing what was missing
     * @return a 401 response
     */
    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ErrorResponse> handleUnauthorized(UnauthorizedException exception) {
        HttpStatus status = HttpStatus.UNAUTHORIZED;
        return ResponseEntity.status(status)
            .header(HttpHeaders.WWW_AUTHENTICATE, "Bearer")
            .body(new ErrorResponse(status.value(), status.getReasonPhrase(), exception.getMessage()));
    }

    /**
     * Handles a request from somebody who may not do what they asked.
     *
     * @param exception the exception describing what was refused
     * @return a 403 response
     */
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(ForbiddenException exception) {
        return build(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    /**
     * Handles a request whose body or parameters are not usable.
     *
     * @param exception the exception describing the problem with the request
     * @return a 400 response
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleBadRequest(IllegalArgumentException exception) {
        return build(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    /**
     * Handles a request that conflicts with the current state, such as reusing an employee id.
     *
     * @param exception the exception describing the conflict
     * @return a 409 response
     */
    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> handleConflict(IllegalStateException exception) {
        return build(HttpStatus.CONFLICT, exception.getMessage());
    }

    /**
     * Handles anything else.
     *
     * The exception message is logged but deliberately not returned. This service is reachable
     * through a public, unauthenticated Function URL, and internal messages are not for strangers.
     *
     * @param exception the unexpected exception
     * @return a 500 response carrying a fixed message
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception exception) {
        log.error("Unhandled exception", exception);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error");
    }

    /**
     * Builds an error response with the given status and message.
     *
     * @param status the HTTP status to return
     * @param message the message to put in the body
     * @return the response entity
     */
    private static ResponseEntity<ErrorResponse> build(HttpStatus status, String message) {
        return ResponseEntity.status(status)
            .body(new ErrorResponse(status.value(), status.getReasonPhrase(), message));
    }
}
