package com.example.config;

import com.example.auth.AuthInterceptor;
import com.example.auth.CallerArgumentResolver;
import com.example.controller.ApiPaths;
import java.util.List;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Wires authentication into Spring MVC.
 *
 * Every endpoint requires a token except the health check and sign-in, which are excluded here by
 * path. The one further exception, creating the first faculty admin before anyone can sign in, is
 * handled by the controller itself through {@code AllowAnonymous} rather than by another exclusion,
 * so that this list stays the complete answer to "what is reachable without a token".
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    /** Checks tokens. */
    private final AuthInterceptor authInterceptor;

    /** Hands the caller to controller methods. */
    private final CallerArgumentResolver callerArgumentResolver;

    /**
     * Creates the configuration.
     *
     * @param authInterceptor the interceptor that checks tokens
     * @param callerArgumentResolver the resolver for Caller parameters
     */
    public WebMvcConfig(
        AuthInterceptor authInterceptor,
        CallerArgumentResolver callerArgumentResolver
    ) {
        this.authInterceptor = authInterceptor;
        this.callerArgumentResolver = callerArgumentResolver;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // Both path shapes, for the reason given on ApiPaths.
        registry.addInterceptor(authInterceptor)
            .addPathPatterns("/**")
            .excludePathPatterns(
                "/",
                ApiPaths.CLOUD_PREFIX,
                ApiPaths.CLOUD_PREFIX + "/",
                ApiPaths.AUTH + "/login",
                ApiPaths.CLOUD_PREFIX + ApiPaths.AUTH + "/login",
                ApiPaths.AUTH + "/register",
                ApiPaths.CLOUD_PREFIX + ApiPaths.AUTH + "/register");
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(callerArgumentResolver);
    }
}
