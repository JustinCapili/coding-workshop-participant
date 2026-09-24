package com.example.auth;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.classes.Role;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/**
 * Pins down the token format and the checks a token has to pass. No Spring context: the service
 * takes an Environment, and a mock one is enough.
 */
class TokenServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    /** Stands in for a stored password digest; the service only fingerprints it. */
    private static final String HASH = "$2a$10$stored-password-digest";

    private final TokenService service = new TokenService(
        new MockEnvironment().withProperty("AUTH_TOKEN_SECRET", "unit-test-secret"));

    @Test
    @DisplayName("a token is a three-part HS256 JWT carrying the standard claims")
    void tokenIsAStandardJwt() throws Exception {
        TokenService.IssuedToken issued = service.issue("E1", "e1@example.com", Role.ENGINEER, HASH);

        String[] parts = issued.token().split("\\.");
        assertThat(parts).hasSize(3);
        assertThat(issued.token()).doesNotContain("=");

        Map<String, Object> header = decode(parts[0]);
        assertThat(header).containsEntry("alg", "HS256").containsEntry("typ", "JWT");

        Map<String, Object> claims = decode(parts[1]);
        assertThat(claims)
            .containsEntry("iss", "springboot-service")
            .containsEntry("sub", "E1")
            .containsEntry("email", "e1@example.com")
            .containsEntry("role", "ENGINEER")
            .containsKeys("pwd", "iat", "exp");
        // A fingerprint of the digest, never the digest itself.
        assertThat(claims.get("pwd")).isInstanceOf(String.class).isNotEqualTo(HASH);
        assertThat(issued.token()).doesNotContain(encode(HASH.getBytes(StandardCharsets.UTF_8)));
        assertThat(((Number) claims.get("exp")).longValue())
            .isEqualTo(issued.expiresAt().getEpochSecond());
        assertThat(issued.expiresAt())
            .isAfter(Instant.now().plus(TokenService.TTL).minusSeconds(5));
    }

    @Test
    @DisplayName("a token the service issued verifies back to its subject and expiry")
    void issuedTokenVerifies() {
        TokenService.IssuedToken issued =
            service.issue("FA1", "fa1@example.com", Role.FACULTY_ADMIN, HASH);

        TokenService.Claims claims = service.verify(issued.token()).orElseThrow();
        assertThat(claims.employeeId()).isEqualTo("FA1");
        assertThat(claims.expiresAt()).isEqualTo(issued.expiresAt());
        assertThat(claims.passwordFingerprint()).isNotBlank();
    }

    @Test
    @DisplayName("a token matches the password it was issued under and no other")
    void tokenIsTiedToThePassword() {
        String token = service.issue("E1", "e1@example.com", Role.ENGINEER, HASH).token();
        TokenService.Claims claims = service.verify(token).orElseThrow();

        assertThat(service.matchesPassword(claims, HASH)).isTrue();
        assertThat(service.matchesPassword(claims, "$2a$10$a-different-digest")).isFalse();
        assertThat(service.matchesPassword(claims, null)).isFalse();
    }

    @Test
    @DisplayName("a token without a password fingerprint, as issued before there was one, never matches")
    void tokenWithoutAFingerprintNeverMatches() {
        TokenService.Claims legacy = new TokenService.Claims("E1", Instant.now().plusSeconds(60), null);

        assertThat(service.matchesPassword(legacy, HASH)).isFalse();
    }

    @Test
    @DisplayName("the same password under another key gives another fingerprint")
    void fingerprintDependsOnTheKey() {
        TokenService other = new TokenService(
            new MockEnvironment().withProperty("AUTH_TOKEN_SECRET", "somebody-else"));
        TokenService.Claims fromOther =
            other.verify(other.issue("E1", "e1@example.com", Role.ENGINEER, HASH).token()).orElseThrow();

        assertThat(service.matchesPassword(fromOther, HASH)).isFalse();
    }

    @Test
    @DisplayName("changing the payload or the signature invalidates the token")
    void tamperingIsDetected() throws Exception {
        String token = service.issue("E1", "e1@example.com", Role.ENGINEER, HASH).token();
        String[] parts = token.split("\\.");

        // Promote ourselves inside the payload and keep the original signature.
        Map<String, Object> claims = decode(parts[1]);
        claims.put("sub", "FA1");
        claims.put("role", "FACULTY_ADMIN");
        String forged = parts[0] + "." + encode(JSON.writeValueAsBytes(claims)) + "." + parts[2];
        assertThat(service.verify(forged)).isEmpty();

        // Damage the signature.
        String damaged = parts[0] + "." + parts[1] + "." + parts[2].substring(1);
        assertThat(service.verify(damaged)).isEmpty();
        assertThat(service.verify(token + "x")).isEmpty();
    }

    @Test
    @DisplayName("the none algorithm and any algorithm other than HS256 are rejected")
    void onlyHs256IsAccepted() throws Exception {
        String token = service.issue("E1", "e1@example.com", Role.ENGINEER, HASH).token();
        String[] parts = token.split("\\.");

        String none = encode("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        assertThat(service.verify(none + "." + parts[1] + ".")).isEmpty();
        assertThat(service.verify(none + "." + parts[1] + "." + parts[2])).isEmpty();

        String rs256 = encode("{\"alg\":\"RS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        assertThat(service.verify(rs256 + "." + parts[1] + "." + parts[2])).isEmpty();
    }

    @Test
    @DisplayName("a token signed with another key is rejected")
    void otherKeysAreRejected() {
        TokenService other = new TokenService(
            new MockEnvironment().withProperty("AUTH_TOKEN_SECRET", "somebody-else"));
        String token = other.issue("E1", "e1@example.com", Role.ENGINEER, HASH).token();

        assertThat(service.verify(token)).isEmpty();
        assertThat(other.verify(token)).isPresent();
    }

    @Test
    @DisplayName("an expired token is rejected")
    void expiredTokensAreRejected() {
        String expired = service.issue(
            "E1", "e1@example.com", Role.ENGINEER, HASH, Instant.now().minus(Duration.ofSeconds(1)))
            .token();

        assertThat(service.verify(expired)).isEmpty();
    }

    @Test
    @DisplayName("garbage in every shape is rejected rather than thrown")
    void garbageIsRejected() {
        assertThat(service.verify(null)).isEmpty();
        assertThat(service.verify("")).isEmpty();
        assertThat(service.verify("abc")).isEmpty();
        assertThat(service.verify("a.b")).isEmpty();
        assertThat(service.verify("a.b.c")).isEmpty();
        assertThat(service.verify("..")).isEmpty();
        assertThat(service.verify("a.b.c.d")).isEmpty();
        assertThat(service.verify("!!!.@@@.###")).isEmpty();
        String notJson = encode("hello".getBytes(StandardCharsets.UTF_8));
        assertThat(service.verify(notJson + "." + notJson + "." + notJson)).isEmpty();
    }

    @Test
    @DisplayName("the key is derived from POSTGRES_PASS when no token secret is set")
    void keyFallsBackToTheSharedSecret() {
        TokenService a = new TokenService(new MockEnvironment().withProperty("POSTGRES_PASS", "db-pw"));
        TokenService b = new TokenService(new MockEnvironment().withProperty("POSTGRES_PASS", "db-pw"));
        TokenService random = new TokenService(new MockEnvironment());

        String token = a.issue("E1", "e1@example.com", Role.ENGINEER, HASH).token();
        assertThat(b.verify(token)).isPresent();
        assertThat(random.verify(token)).isEmpty();
    }

    private static Map<String, Object> decode(String segment) throws Exception {
        return JSON.readValue(Base64.getUrlDecoder().decode(segment), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() { });
    }

    private static String encode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
