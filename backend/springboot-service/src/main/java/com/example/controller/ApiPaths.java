package com.example.controller;

/**
 * The base paths each controller is mapped on.
 *
 * Every controller is mapped twice, because the same application is reached through two different
 * paths. Locally, bin/proxy-server.js strips the /api/springboot-service prefix before forwarding, so
 * the application sees /faculty-admins. In the cloud, CloudFront matches /api/springboot-service* and
 * forwards the path untouched, so the application sees /api/springboot-service/faculty-admins.
 *
 * Mapping both literals is a deliberate choice over a filter that rewrites the request path. A filter
 * would be tidier, but it depends on filters being honoured inside the serverless container's own
 * servlet context, and MockMvc runs on a real mock container — so a broken filter passes every test
 * locally and only fails after a deploy. Two strings cannot fail that way, and the test suite asserts
 * both of them.
 *
 * These are compile-time constants, so they are legal inside an annotation and can be concatenated
 * there. Public because {@code WebMvcConfig} registers the authentication interceptor on the same
 * paths, and a second copy of these strings would be a second thing to keep in step.
 */
public final class ApiPaths {

    /** The prefix CloudFront leaves on the path, matching the service directory name. */
    public static final String CLOUD_PREFIX = "/api/springboot-service";

    /** Base path for the faculty admin endpoints, as seen locally. */
    public static final String FACULTY_ADMINS = "/faculty-admins";

    /** Base path for the engineer endpoints, as seen locally. */
    public static final String ENGINEERS = "/engineers";

    /** Base path for the plain employee endpoints, as seen locally. */
    public static final String EMPLOYEES = "/employees";

    /** Base path for signing in, as seen locally. */
    public static final String AUTH = "/auth";

    /** Base path for the report endpoints, as seen locally. */
    public static final String REPORTS = "/reports";

    /**
     * Not instantiable.
     */
    private ApiPaths() {
    }
}
