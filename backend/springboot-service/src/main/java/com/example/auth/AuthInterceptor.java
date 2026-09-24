package com.example.auth;

import com.example.classes.Employee;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Requires a valid bearer token on the paths it is registered for, and records who the caller is.
 *
 * An interceptor rather than a servlet filter, on purpose. The service README records that inside
 * the serverless container a filter's URL patterns are silently ignored, while interceptor path
 * patterns are honoured and exceptions thrown from preHandle reach the exception handler. This
 * therefore behaves the same under MockMvc and on Lambda.
 *
 * Three kinds of request get through without a token: a CORS preflight, which carries no
 * credentials by definition; a path {@code WebMvcConfig} excludes, which is only the health check
 * and sign-in; and a handler marked {@link AllowAnonymous} when no Authorization header is sent at
 * all. A header that is present is always checked, wherever it is sent.
 *
 * The employee is looked up on every request rather than trusted from the token, so a token for
 * somebody who has since been deleted stops working immediately, and a promotion takes effect on
 * the next call rather than at the next sign-in. The same lookup supplies the current password
 * digest, and a token issued under an earlier password is refused, so changing a password signs
 * out every other session.
 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    /** The request attribute the resolved caller is stored under. */
    static final String CALLER_ATTRIBUTE = Caller.class.getName();

    /** The scheme expected in the Authorization header. */
    private static final String BEARER = "Bearer ";

    /** Verifies tokens. */
    private final TokenService tokenService;

    /** Resolves the employee a token names. */
    private final EmployeeDirectory directory;

    /**
     * Creates the interceptor.
     *
     * @param tokenService the token verifier
     * @param directory the employee lookup
     */
    public AuthInterceptor(TokenService tokenService, EmployeeDirectory directory) {
        this.tokenService = tokenService;
        this.directory = directory;
    }

    @Override
    public boolean preHandle(
        HttpServletRequest request,
        HttpServletResponse response,
        Object handler
    ) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null) {
            if (allowsAnonymous(handler)) {
                return true;
            }
            throw new UnauthorizedException("Sign in to continue");
        }
        if (!header.regionMatches(true, 0, BEARER, 0, BEARER.length())) {
            throw new UnauthorizedException("Sign in to continue");
        }
        TokenService.Claims claims = tokenService.verify(header.substring(BEARER.length()).trim())
            .orElseThrow(() -> new UnauthorizedException("Your session has expired; sign in again"));
        Employee employee = directory.findById(claims.employeeId())
            .orElseThrow(() -> new UnauthorizedException("Your account no longer exists"));
        if (!tokenService.matchesPassword(claims, employee.getPassword())) {
            throw new UnauthorizedException("Your password was changed; sign in again");
        }
        request.setAttribute(CALLER_ATTRIBUTE, Caller.of(employee));
        return true;
    }

    /**
     * Returns the caller the interceptor stored on this request.
     *
     * @param request the current request
     * @return the caller
     * @throws UnauthorizedException if nobody signed in on this request
     */
    static Caller callerOf(HttpServletRequest request) {
        return optionalCallerOf(request)
            .orElseThrow(() -> new UnauthorizedException("Sign in to continue"));
    }

    /**
     * Returns the caller the interceptor stored on this request, if there is one.
     *
     * @param request the current request
     * @return the caller, or empty on an {@link AllowAnonymous} request that sent no token
     */
    static Optional<Caller> optionalCallerOf(HttpServletRequest request) {
        Object caller = request.getAttribute(CALLER_ATTRIBUTE);
        return caller instanceof Caller resolved ? Optional.of(resolved) : Optional.empty();
    }

    /**
     * Reports whether the handler has opted out of requiring a token.
     *
     * @param handler the handler Spring chose for the request
     * @return true when it is a controller method annotated {@link AllowAnonymous}
     */
    private static boolean allowsAnonymous(Object handler) {
        return handler instanceof HandlerMethod method
            && method.hasMethodAnnotation(AllowAnonymous.class);
    }
}
