package com.example.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Marks a controller method that may be called without a bearer token.
 *
 * {@link AuthInterceptor} guards every endpoint except the health check and sign-in. On a method
 * carrying this annotation it lets a request with no Authorization header through, without a
 * caller; a header that is present is still verified, and a bad one is still a 401. The method
 * then decides for itself, usually by taking an {@code Optional<Caller>} parameter.
 *
 * Used once: creating the first faculty admin, before anybody exists who could sign in.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AllowAnonymous {
}
