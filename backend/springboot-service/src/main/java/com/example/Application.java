package com.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Spring Boot entry point.
 *
 * Component scanning starts from this package, so the controllers in {@code com.example.controller}
 * and the repositories in {@code com.example.repos} are picked up automatically. The domain classes
 * and the request and response records hold no beans, which is why they are scanned but contribute
 * nothing.
 *
 * Used two ways: started directly by {@link #main(String[])} during local development, and
 * bootstrapped by {@link Handler} when running on AWS Lambda.
 */
@SpringBootApplication
public class Application {

    /**
     * Starts an embedded web server for local development.
     *
     * @param args command line arguments passed through to Spring Boot
     */
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
