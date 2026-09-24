package com.example.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/**
 * Builds the PostgreSQL connection from the environment variables Terraform injects.
 *
 * The platform supplies POSTGRES_HOST, POSTGRES_PORT, POSTGRES_NAME, POSTGRES_USER and POSTGRES_PASS
 * to every backend service automatically (see infra/locals.tf), so none of them are configured by
 * hand. The defaults below apply only when the application runs outside Lambda, such as under
 * {@code mvn spring-boot:run} or in tests, where those variables are absent.
 *
 * This is a bean rather than a spring.datasource.url property because the TLS mode depends on where
 * the service is running, and IS_LOCAL arrives as the string "true" or "false" rather than as
 * something a property placeholder can branch on.
 */
@Configuration
public class DataSourceConfig {

    /** JDBC URL template: host, port, database, then the schema and TLS mode. */
    private static final String URL_TEMPLATE =
        "jdbc:postgresql://%s:%s/%s?currentSchema=%s&sslmode=%s";

    /**
     * The schema this service owns.
     *
     * Every backend service in this repository shares one database, so an unqualified table name in
     * the public schema would collide with the next service to define one. Pinning the schema on the
     * connection keeps the SQL unqualified while the tables stay separate.
     */
    private static final String SCHEMA = "springboot_service";

    /**
     * Builds the connection pool.
     *
     * Marked with Bean, which means Spring calls this method once during startup and keeps the
     * returned pool in the application context. Everything that needs a DataSource is handed that one
     * instance: the JdbcClient, the schema.sql runner, and the repositories. Calling this method
     * directly would build a second pool, which is why nothing should.
     *
     * Declaring it here also stops Spring Boot configuring a DataSource of its own. Its
     * auto-configuration is conditional on no DataSource bean already existing, so this method is
     * what makes it stand aside.
     *
     * The pool is deliberately small. Every Lambda execution environment gets its own, so a pool of
     * ten across twenty warm environments is two hundred connections competing for an Aurora instance
     * that may have scaled down to nothing.
     *
     * The ConfigurationProperties annotation binds spring.datasource.hikari.* onto the pool after it
     * is built, so the tunables stay visible in application.properties instead of being buried here.
     * The return type must stay HikariDataSource: Spring binds against the method's declared type,
     * and the DataSource interface has no pool setters, so declaring that silently ignored every
     * property and left Hikari at its default of ten connections.
     *
     * @param environment the Spring environment, injected by Spring, read for the database variables
     * @return the configured PostgreSQL data source
     */
    @Bean
    @ConfigurationProperties("spring.datasource.hikari")
    public HikariDataSource dataSource(Environment environment) {
        boolean isLocal = "true".equals(environment.getProperty("IS_LOCAL", "true"));

        String url = String.format(
            URL_TEMPLATE,
            environment.getProperty("POSTGRES_HOST", "localhost"),
            environment.getProperty("POSTGRES_PORT", "5432"),
            environment.getProperty("POSTGRES_NAME", "postgres"),
            SCHEMA,
            // Aurora requires TLS; the local server does not offer it. "require" rather than
            // "prefer" so a cloud misconfiguration fails loudly instead of silently downgrading.
            isLocal ? "disable" : "require"
        );

        return DataSourceBuilder.create()
            .type(HikariDataSource.class)
            .url(url)
            .username(environment.getProperty("POSTGRES_USER", "postgres"))
            .password(environment.getProperty("POSTGRES_PASS", "postgres"))
            .build();
    }
}
