package com.example.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.zaxxer.hikari.HikariDataSource;
import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Checks that the spring.datasource.hikari.* properties actually reach the pool.
 *
 * They silently did not while the bean method declared DataSource as its return type: Spring binds
 * against that declared type, the interface has no pool setters, and Hikari stayed at its default of
 * ten connections per Lambda instance. Nothing else in the suite would notice, since the pool is
 * never asked for a connection under the test profile.
 *
 * Same Spring Boot configuration as the controller tests, so the cached context is reused.
 */
@SpringBootTest(properties = {
    "spring.autoconfigure.exclude="
        + "org.springframework.cloud.function.serverless.web.ServerlessAutoConfiguration",
    "spring.sql.init.mode=never"
})
@ActiveProfiles("test")
@AutoConfigureMockMvc
class DataSourceConfigTest {

    @Autowired
    private DataSource dataSource;

    @Test
    @DisplayName("the pool is sized from application.properties, not Hikari's defaults")
    void poolSettingsAreBound() {
        assertThat(dataSource).isInstanceOf(HikariDataSource.class);
        HikariDataSource pool = (HikariDataSource) dataSource;
        assertThat(pool.getMaximumPoolSize()).isEqualTo(2);
        assertThat(pool.getMinimumIdle()).isEqualTo(1);
    }
}
