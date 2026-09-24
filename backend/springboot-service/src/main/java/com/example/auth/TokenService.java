package com.example.auth;

import com.example.classes.Role;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Issues and checks the JSON Web Tokens that identify a signed-in employee.
 *
 * A token is a JWS in compact serialization (RFC 7515) signed with HMAC-SHA256, carrying the
 * registered claims {@code sub}, {@code iat} and {@code exp} plus {@code email} and {@code role}
 * for the client's convenience. Stateless, so any Lambda execution environment can verify one
 * issued by any other without a shared session store.
 *
 * Written against the JDK rather than a JWT library on purpose: HS256 needs only {@link Mac} and
 * base64url, Jackson is already on the classpath, and every extra jar is cold-start time on a
 * 128 MB function. Only HS256 is accepted when verifying; a token whose header names any other
 * algorithm, including {@code none}, is rejected before its signature is looked at.
 *
 * The role inside the token is informational. {@link AuthInterceptor} looks the employee up on
 * every request, so what the token says about somebody never outranks what the directory says now.
 *
 * A {@code pwd} (password) claim ties the token to the password it was issued under: an HMAC of the
 * stored password digest, so the claim reveals nothing about the digest to anyone who decodes the
 * token.
 * Changing a password changes the digest, and {@link #matchesPassword} then fails for every token
 * issued before the change, which is how a password change signs out every other session.
 *
 * The signing key comes from {@code AUTH_TOKEN_SECRET}. When that is absent, it is derived from
 * {@code POSTGRES_PASS}, the one secret every execution environment is guaranteed to share. Only
 * when neither exists — local runs and tests — is a random key generated, and then tokens die with
 * the process, which is fine for both.
 */
@Component
public class TokenService {

    /** Logger for the key-source warning. */
    private static final Logger log = LoggerFactory.getLogger(TokenService.class);

    /** How long a token stays valid after it is issued. */
    static final Duration TTL = Duration.ofHours(12);

    /** The MAC algorithm used to sign tokens. */
    private static final String MAC_ALGORITHM = "HmacSHA256";

    /** The JWS algorithm name that corresponds to {@link #MAC_ALGORITHM}. */
    private static final String JWS_ALGORITHM = "HS256";

    /** The {@code iss} claim written into every token. */
    private static final String ISSUER = "springboot-service";

    /** The JOSE header, identical for every token so encoded once. */
    private static final String ENCODED_HEADER =
        encode("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

    /** Reads and writes the claims. */
    private static final ObjectMapper JSON = new ObjectMapper();

    /** Shape of a decoded claims object. */
    private static final TypeReference<Map<String, Object>> CLAIMS =
        new TypeReference<Map<String, Object>>() { };

    /** The signing key. */
    private final SecretKeySpec key;

    /**
     * Creates the service, choosing the signing key as described on the class.
     *
     * @param environment the Spring environment, read for the secret variables
     */
    public TokenService(Environment environment) {
        this.key = new SecretKeySpec(resolveKey(environment), MAC_ALGORITHM);
    }

    /**
     * A token that has just been issued, with the moment it stops working.
     *
     * @param token the compact JWS to send as {@code Authorization: Bearer <token>}
     * @param expiresAt when the token expires
     */
    public record IssuedToken(String token, Instant expiresAt) {
    }

    /**
     * What a verified token says about its holder.
     *
     * @param employeeId the {@code sub} claim
     * @param expiresAt the {@code exp} claim
     * @param passwordFingerprint the {@code pwd} claim, or null when the token has none
     */
    public record Claims(String employeeId, Instant expiresAt, String passwordFingerprint) {
    }

    /**
     * Issues a token for the given employee, valid for {@link #TTL} from now.
     *
     * @param employeeId the employee the token identifies
     * @param email their email address, carried as a claim
     * @param role their role, carried as a claim
     * @param passwordHash their stored password digest, fingerprinted into the {@code pwd} claim
     * @return the signed token and its expiry
     */
    public IssuedToken issue(String employeeId, String email, Role role, String passwordHash) {
        return issue(employeeId, email, role, passwordHash, Instant.now().plus(TTL));
    }

    /**
     * Issues a token with an explicit expiry. Package-private so tests can mint an expired one.
     *
     * @param employeeId the employee the token identifies
     * @param email their email address
     * @param role their role
     * @param passwordHash their stored password digest
     * @param expiresAt when the token should stop working
     * @return the signed token and its expiry
     */
    IssuedToken issue(
        String employeeId,
        String email,
        Role role,
        String passwordHash,
        Instant expiresAt
    ) {
        // Whole seconds, as RFC 7519 defines NumericDate; the returned instant is truncated to
        // match so a client comparing the two sees the same moment.
        Instant expiry = Instant.ofEpochSecond(expiresAt.getEpochSecond());
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", ISSUER);
        claims.put("sub", employeeId);
        claims.put("email", email);
        claims.put("role", role == null ? null : role.name());
        // "pwd" (password): a keyed fingerprint of the password digest this token was issued under.
        // Not the digest itself, and nothing a reader of the token can reverse. Once the password
        // changes the fingerprint no longer matches, so AuthInterceptor turns the token away.
        claims.put("pwd", fingerprint(passwordHash));
        claims.put("iat", Instant.now().getEpochSecond());
        claims.put("exp", expiry.getEpochSecond());

        String signingInput;
        try {
            signingInput = ENCODED_HEADER + "." + encode(JSON.writeValueAsBytes(claims));
        } catch (JsonProcessingException impossible) {
            // A map of strings and longs always serializes.
            throw new IllegalStateException(impossible);
        }
        return new IssuedToken(signingInput + "." + encode(sign(signingInput)), expiry);
    }

    /**
     * Checks a token and returns what it says.
     *
     * @param token the token as presented by the caller
     * @return the claims, or empty when the token is malformed, uses another algorithm, is signed
     *     with another key, has expired, or names nobody
     */
    public Optional<Claims> verify(String token) {
        if (token == null) {
            return Optional.empty();
        }
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3 || parts[0].isEmpty() || parts[1].isEmpty() || parts[2].isEmpty()) {
            return Optional.empty();
        }

        Map<String, Object> header = decodeJson(parts[0]);
        if (header == null || !JWS_ALGORITHM.equals(header.get("alg"))) {
            return Optional.empty();
        }

        byte[] presented = decode(parts[2]);
        if (presented == null) {
            return Optional.empty();
        }
        // Constant-time comparison: a plain equals would leak how many leading bytes matched.
        if (!MessageDigest.isEqual(presented, sign(parts[0] + "." + parts[1]))) {
            return Optional.empty();
        }

        Map<String, Object> claims = decodeJson(parts[1]);
        if (claims == null) {
            return Optional.empty();
        }
        Long expiry = numericDate(claims.get("exp"));
        if (expiry == null || Instant.now().getEpochSecond() >= expiry) {
            return Optional.empty();
        }
        if (!(claims.get("sub") instanceof String subject) || subject.isBlank()) {
            return Optional.empty();
        }
        String fingerprint = claims.get("pwd") instanceof String pwd ? pwd : null;
        return Optional.of(new Claims(subject, Instant.ofEpochSecond(expiry), fingerprint));
    }

    /**
     * Reports whether a verified token was issued under the password the employee has now.
     *
     * @param claims what the token said
     * @param passwordHash the employee's stored password digest as of now
     * @return true when the token's {@code pwd} claim matches; false when it differs, which means
     *     the password has changed since the token was issued, or when the token has no such claim
     */
    public boolean matchesPassword(Claims claims, String passwordHash) {
        if (claims.passwordFingerprint() == null) {
            return false;
        }
        // Constant-time, for the same reason as the signature check.
        return MessageDigest.isEqual(
            claims.passwordFingerprint().getBytes(StandardCharsets.UTF_8),
            fingerprint(passwordHash).getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Fingerprints a password digest for the {@code pwd} claim.
     *
     * Keyed with the service key and prefixed, so the value is useless outside this service and
     * never equals a signature over any other input.
     *
     * @param passwordHash the stored password digest
     * @return the base64url-encoded fingerprint
     */
    private String fingerprint(String passwordHash) {
        return encode(sign("pwd:" + (passwordHash == null ? "" : passwordHash)));
    }

    /**
     * Signs the given text with the service key.
     *
     * @param text the text to sign
     * @return the MAC
     */
    private byte[] sign(String text) {
        try {
            Mac mac = Mac.getInstance(MAC_ALGORITHM);
            mac.init(key);
            return mac.doFinal(text.getBytes(StandardCharsets.UTF_8));
        } catch (java.security.GeneralSecurityException unavailable) {
            // HmacSHA256 is mandatory in every Java runtime, so this cannot happen.
            throw new IllegalStateException(unavailable);
        }
    }

    /**
     * Reads a NumericDate claim, which Jackson may have parsed as an Integer or a Long.
     *
     * @param value the raw claim value
     * @return the epoch seconds, or null when the claim is missing or not a number
     */
    private static Long numericDate(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    /**
     * Decodes one base64url segment as a JSON object.
     *
     * @param segment the encoded segment
     * @return the object, or null when the segment is not base64url or not a JSON object
     */
    private static Map<String, Object> decodeJson(String segment) {
        byte[] bytes = decode(segment);
        if (bytes == null) {
            return null;
        }
        try {
            return JSON.readValue(bytes, CLAIMS);
        } catch (IOException malformed) {
            return null;
        }
    }

    /**
     * Decodes unpadded base64url.
     *
     * @param segment the encoded text
     * @return the bytes, or null when the text is not base64url
     */
    private static byte[] decode(String segment) {
        try {
            return Base64.getUrlDecoder().decode(segment);
        } catch (IllegalArgumentException malformed) {
            return null;
        }
    }

    /**
     * Encodes bytes as unpadded base64url, as JWS requires.
     *
     * @param bytes the bytes to encode
     * @return the encoded text
     */
    private static String encode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * Picks the signing key from the environment, as described on the class.
     *
     * @param environment the Spring environment
     * @return the key bytes
     */
    private static byte[] resolveKey(Environment environment) {
        String configured = environment.getProperty("AUTH_TOKEN_SECRET");
        if (configured != null && !configured.isBlank()) {
            return configured.getBytes(StandardCharsets.UTF_8);
        }
        String shared = environment.getProperty("POSTGRES_PASS");
        if (shared != null && !shared.isBlank()) {
            // Derived rather than used directly, so the token key is never the database password.
            try {
                Mac mac = Mac.getInstance(MAC_ALGORITHM);
                mac.init(new SecretKeySpec(shared.getBytes(StandardCharsets.UTF_8), MAC_ALGORITHM));
                return mac.doFinal("springboot-service auth token key".getBytes(StandardCharsets.UTF_8));
            } catch (java.security.GeneralSecurityException unavailable) {
                throw new IllegalStateException(unavailable);
            }
        }
        log.warn("AUTH_TOKEN_SECRET is not set; issuing tokens with a per-process key. "
            + "Tokens will not survive a restart or be valid across Lambda environments.");
        byte[] random = new byte[32];
        new SecureRandom().nextBytes(random);
        return random;
    }
}
