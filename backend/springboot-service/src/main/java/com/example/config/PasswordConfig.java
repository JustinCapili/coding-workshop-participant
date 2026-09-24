package com.example.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Supplies the password encoder used when a new member of staff is created.
 *
 * This comes from spring-security-crypto rather than the Spring Security starter, so the application
 * gets the hashing algorithms and nothing else: no filter chain, no login page, no auto-configuration
 * deciding that every endpoint now needs authentication.
 */
@Configuration
public class PasswordConfig {

    /**
     * Builds the password encoder.
     *
     * BCrypt is used at its default cost, which is deliberately slow: the work factor is the entire
     * defence, since it is what stops an attacker who has the digests from testing candidate passwords
     * quickly. That cost is paid on every create request, and a Lambda sized at 128 MB receives a
     * correspondingly small share of a CPU, so creating staff may feel sluggish once deployed. The
     * answer if it does is a lower cost factor, chosen after measuring, rather than no hashing.
     *
     * The returned encoder also salts each digest individually, so two people sharing a password do
     * not share a hash, and it needs no salt column of its own — the salt travels inside the digest.
     *
     * @return the encoder used to hash passwords before they are stored
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
