package com.example.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Lets the Vite dev server call a locally run service directly.
 *
 * Deployed, the Lambda Function URL answers CORS, and under ./bin/start-dev.sh bin/proxy-server.js
 * does; the application itself never has to. A local profile run on port 3001 has neither in front
 * of it, so without this the browser on :3000 would refuse every response. Local profile only, so
 * nothing here reaches the deployed function.
 */
@Configuration
@Profile("local")
public class LocalCorsConfig implements WebMvcConfigurer {

    /** Where `npm run dev` serves the frontend (frontend/vite.config.js). */
    private static final String FRONTEND_ORIGIN = "http://localhost:3000";

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOrigins(FRONTEND_ORIGIN)
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(false);
    }
}
