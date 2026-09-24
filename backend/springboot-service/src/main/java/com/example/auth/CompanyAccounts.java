package com.example.auth;

import java.util.Locale;

/**
 * The company's account rules: which addresses may hold a new account, and who the default admin is.
 *
 * Every new account, self-registered or created by an admin, must use an {@value #EMAIL_DOMAIN}
 * address. Accounts that already exist under another address keep signing in; only creation is
 * checked. The default admin, {@value #DEFAULT_ADMIN_EMAIL}, is the one account that may make
 * faculty admins, by creating one or by promoting an employee or engineer.
 */
public final class CompanyAccounts {

    /** The one domain new accounts may use. */
    public static final String EMAIL_DOMAIN = "acme.inc";

    /** The default admin, seeded on startup, and the only account that may make faculty admins. */
    public static final String DEFAULT_ADMIN_EMAIL = "admin@" + EMAIL_DOMAIN;

    /** What the default admin was called before the company moved to {@value #EMAIL_DOMAIN}. */
    public static final String LEGACY_ADMIN_EMAIL = "admin@acme.com";

    private CompanyAccounts() {
    }

    /**
     * Refuses an address outside the company domain, ignoring case and surrounding whitespace.
     *
     * The domain must match exactly: {@code x@sub.acme.inc} and {@code x@acme.inc.example.com} are
     * both refused.
     *
     * @param email the address a new account would have
     * @throws IllegalArgumentException if it is not an {@value #EMAIL_DOMAIN} address
     */
    public static void requireCompanyEmail(String email) {
        if (!isCompanyEmail(email)) {
            throw new IllegalArgumentException("email must be an @" + EMAIL_DOMAIN + " address");
        }
    }

    /**
     * Reports whether an address is in the company domain, ignoring case and surrounding whitespace.
     *
     * @param email the address to check, possibly null
     * @return true for a non-empty local part followed by exactly {@code @acme.inc}
     */
    public static boolean isCompanyEmail(String email) {
        if (email == null) {
            return false;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        int at = normalized.lastIndexOf('@');
        return at > 0 && normalized.indexOf('@') == at
            && normalized.substring(at + 1).equals(EMAIL_DOMAIN);
    }

    /**
     * Reports whether an address is the default admin's, ignoring case and surrounding whitespace.
     *
     * @param email the address to check, possibly null
     * @return true for {@value #DEFAULT_ADMIN_EMAIL}
     */
    public static boolean isDefaultAdminEmail(String email) {
        return email != null && DEFAULT_ADMIN_EMAIL.equalsIgnoreCase(email.trim());
    }
}
