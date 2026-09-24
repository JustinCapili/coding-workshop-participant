package com.example.classes;

/**
 * Base type for everyone who can sign in to the service.
 *
 * This class holds the credentials every user has — an email address and a password — and nothing
 * else. It is abstract because "a user" is never a complete description of anyone: every real user is
 * an {@link Employee}, and every employee is either an {@link Engineer} or a {@link FacultyAdmin}.
 *
 * It is a class rather than an interface because it carries state and a constructor. An interface can
 * do neither, so turning it into one would push the email and password fields down into every
 * subclass, which is the duplication this hierarchy exists to prevent.
 */
public abstract class User {

    /** The user's email address, also used as the login name. */
    private String email;

    /**
     * The user's credential, as stored.
     *
     * For anyone created through the API this holds a BCrypt digest, not a password: the controllers
     * hash the incoming value before constructing the object, so plaintext never reaches this field.
     * The name is kept because it is what the credential is from the domain's point of view; the
     * database column that receives it is named password_hash to be unambiguous.
     */
    private String password;

    /**
     * Creates a user with the given credentials.
     *
     * Declared protected because an abstract class can only ever be constructed through a subclass
     * constructor, and the visibility should say so.
     *
     * @param email the user's email address
     * @param password the user's password
     */
    protected User(String email, String password) {
        this.email = email;
        this.password = password;
    }

    /**
     * Returns the user's email address.
     *
     * @return the email address
     */
    public String getEmail() {
        return email;
    }

    /**
     * Updates the user's email address.
     *
     * @param email the new email address
     */
    public void setEmail(String email) {
        this.email = email;
    }

    /**
     * Returns the stored credential, which for anyone created through the API is a BCrypt digest.
     *
     * Never write the result of this method into an HTTP response. The response records in
     * {@code com.example.model} have no password field precisely so that this cannot happen by
     * accident, and a digest is not safe to publish merely because it is not plaintext.
     *
     * To check a submitted password against this value, pass both to
     * {@code PasswordEncoder.matches}. Comparing with equals will always fail, because every digest
     * carries its own salt.
     *
     * @return the stored credential
     */
    public String getPassword() {
        return password;
    }

    /**
     * Updates the user's password.
     *
     * @param password the new password
     */
    public void setPassword(String password) {
        this.password = password;
    }
}
