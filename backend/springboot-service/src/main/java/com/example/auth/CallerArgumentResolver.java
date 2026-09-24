package com.example.auth;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * Lets a controller method declare a {@link Caller} parameter and receive the signed-in employee.
 *
 * Reads what {@link AuthInterceptor} stored. A plain {@code Caller} parameter fails with 401 when
 * nobody signed in, so a method that takes one can never run anonymously by mistake. A method
 * marked {@link AllowAnonymous} takes an {@code Optional<Caller>} instead and gets empty.
 */
@Component
public class CallerArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return Caller.class.equals(parameter.getParameterType()) || isOptionalCaller(parameter);
    }

    @Override
    public Object resolveArgument(
        MethodParameter parameter,
        ModelAndViewContainer mavContainer,
        NativeWebRequest webRequest,
        WebDataBinderFactory binderFactory
    ) {
        HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
        if (isOptionalCaller(parameter)) {
            return request == null ? Optional.empty() : AuthInterceptor.optionalCallerOf(request);
        }
        if (request == null) {
            throw new UnauthorizedException("Sign in to continue");
        }
        return AuthInterceptor.callerOf(request);
    }

    /**
     * Reports whether the parameter is declared as {@code Optional<Caller>}.
     *
     * @param parameter the controller method parameter
     * @return true for an optional caller
     */
    private static boolean isOptionalCaller(MethodParameter parameter) {
        return Optional.class.equals(parameter.getParameterType())
            && Caller.class.equals(parameter.nestedIfOptional().getNestedParameterType());
    }
}
