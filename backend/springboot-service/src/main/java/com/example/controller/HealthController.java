package com.example.controller;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Answers the service root, so the smoke test in backend/README.md works.
 *
 * That README tells participants to check a service with {@code curl .../api/springboot-service}.
 * Locally the proxy strips the prefix and the application sees "/"; in the cloud the path arrives
 * intact. Without mappings for both, the documented command returns 404 and a perfectly healthy
 * deployment looks broken.
 */
@RestController
public class HealthController {

    /**
     * Reports that the service is up.
     *
     * @return the service name and its status
     */
    @GetMapping({"/", ApiPaths.CLOUD_PREFIX, ApiPaths.CLOUD_PREFIX + "/"})
    public Map<String, String> index() {
        return Map.of("service", "springboot-service", "status", "ok");
    }
}
