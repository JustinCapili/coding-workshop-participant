package com.example.controller;

import com.example.auth.Caller;
import com.example.auth.EmployeeDirectory;
import com.example.auth.ForbiddenException;
import com.example.auth.TokenService;
import com.example.auth.UnauthorizedException;
import com.example.classes.Employee;
import com.example.classes.Role;
import com.example.model.ChangePasswordRequest;
import com.example.model.EmployeeSummary;
import com.example.model.LoginRequest;
import com.example.model.LoginResponse;
import com.example.model.VerifyPasswordRequest;
import com.example.repos.EmployeeRepository;
import com.example.service.Ids;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Signing in, staying signed in, finding out who is signed in, and changing your own password.
 *
 * Sign-in and registration are the only methods here reachable without a token; {@code WebMvcConfig}
 * excludes their paths. Mapped on two base paths for the reason explained in {@link ApiPaths}.
 */
@RestController
@RequestMapping({ApiPaths.AUTH, ApiPaths.CLOUD_PREFIX + ApiPaths.AUTH})
public class AuthController {

    /** The shortest password a self-registered account may have. */
    static final int MIN_PASSWORD_LENGTH = 8;

    /** Something, an @, something, a dot, something; no whitespace. Deliberately loose. */
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    /** Finds the employee behind an email address or id, and saves a changed password. */
    private final EmployeeDirectory directory;

    /** Stores self-registered plain employees. */
    private final EmployeeRepository employeeRepository;

    /** Checks a submitted password against the stored digest. */
    private final PasswordEncoder passwordEncoder;

    /** Issues tokens. */
    private final TokenService tokenService;

    /**
     * Creates the controller.
     *
     * @param directory the employee lookup
     * @param employeeRepository where registration stores new plain employees
     * @param passwordEncoder the encoder the stored digests were made with
     * @param tokenService the token issuer
     */
    public AuthController(
        EmployeeDirectory directory,
        EmployeeRepository employeeRepository,
        PasswordEncoder passwordEncoder,
        TokenService tokenService
    ) {
        this.directory = directory;
        this.employeeRepository = employeeRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
    }

    /**
     * Signs an employee in.
     *
     * An unknown address and a wrong password get the same answer, so the endpoint cannot be used
     * to find out which addresses have accounts.
     *
     * @param request the credentials
     * @return 200 with a token, its expiry and the signed-in employee, 400 for a malformed body, or
     *     401 when the credentials do not match
     */
    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("A request body is required");
        }
        requireText(request.email(), "email");
        requireText(request.password(), "password");

        Employee employee = directory.findByEmail(request.email().trim())
            .filter(found -> passwordEncoder.matches(request.password(), found.getPassword()))
            .orElseThrow(() -> new UnauthorizedException("Invalid email or password"));

        return respond(employee);
    }

    /**
     * Creates an account for a plain employee, and signs them in.
     *
     * Self-service: anybody may call this without a token, which is how staff who file reports get
     * an account. It only ever creates the EMPLOYEE role; engineers and faculty admins are still
     * provisioned by a faculty admin. The employee id is generated here, not chosen by the caller.
     *
     * The email must be unused by every kind of account, not only other plain employees, so an
     * engineer or admin cannot hold a second account under the same address.
     *
     * @param request the email and password for the new account
     * @return 201 with a token, its expiry and the new employee, as login returns; 400 for a
     *     malformed email or a password under {@value #MIN_PASSWORD_LENGTH} characters; 409 when an
     *     account already has that email
     */
    @PostMapping("/register")
    public ResponseEntity<LoginResponse> register(@RequestBody LoginRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("A request body is required");
        }
        requireText(request.email(), "email");
        requireText(request.password(), "password");
        String email = request.email().trim();
        if (!EMAIL.matcher(email).matches()) {
            throw new IllegalArgumentException("email must be a valid email address");
        }
        if (request.password().length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalArgumentException(
                "password must be at least " + MIN_PASSWORD_LENGTH + " characters");
        }
        if (directory.findByEmail(email).isPresent()) {
            throw new IllegalStateException("An account with email " + email + " already exists");
        }

        String employeeId;
        do {
            employeeId = Ids.next("EMP");
        } while (directory.existsById(employeeId));

        // Hashed here, at the edge, so the plaintext never reaches the domain object or the store.
        Employee created = employeeRepository.save(
            new Employee(email, passwordEncoder.encode(request.password()), employeeId));
        return ResponseEntity.status(HttpStatus.CREATED).body(respond(created));
    }

    /**
     * Exchanges a valid token for a fresh one, so a client that is still in use never has to ask
     * for the password again.
     *
     * Refresh is only possible while the current token still verifies: an expired token is a 401
     * like anywhere else, and the client signs in again. The new token reflects the employee as
     * they are now, so a promotion since sign-in shows up in it.
     *
     * @param caller the signed-in employee
     * @return 200 with a new token, its expiry and the employee, or 401 without a valid token
     */
    @PostMapping("/refresh")
    public LoginResponse refresh(Caller caller) {
        return respond(signedIn(caller));
    }

    /**
     * Returns the signed-in employee, as the token identifies them now.
     *
     * @param caller the signed-in employee
     * @return 200 with the employee, or 401 without a valid token
     */
    @GetMapping("/me")
    public EmployeeSummary me(Caller caller) {
        return EmployeeSummary.from(caller);
    }

    /**
     * Checks the signed-in employee's current password, without changing anything.
     *
     * The first step of changing a password, so the website can stop somebody at the wrong password
     * before they type a new one. A wrong password is 403, not 401: the caller's token is fine, and
     * the website treats any 401 as a lost session and signs out.
     *
     * @param caller the signed-in employee
     * @param request the password to check
     * @return 204 when it is their current password, 400 when it is blank, or 403 when it is wrong
     */
    @PostMapping("/verify-password")
    public ResponseEntity<Void> verifyPassword(
        Caller caller,
        @RequestBody VerifyPasswordRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException("A request body is required");
        }
        requireText(request.password(), "password");
        requireCurrentPassword(signedIn(caller), request.password());
        return ResponseEntity.noContent().build();
    }

    /**
     * Changes the signed-in employee's own password.
     *
     * The current password is checked again here even when the website verified it a moment ago,
     * since this call is the one that counts. The answer carries a fresh token for the new password;
     * every token issued before the change stops working, which signs out every other session.
     *
     * @param caller the signed-in employee
     * @param request the current password and the new one
     * @return 200 with a new token, its expiry and the employee, as login returns; 400 for a blank
     *     field, a new password under {@value #MIN_PASSWORD_LENGTH} characters, or one the same as
     *     the current password; 403 when the current password is wrong
     */
    @PutMapping("/password")
    public LoginResponse changePassword(Caller caller, @RequestBody ChangePasswordRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("A request body is required");
        }
        requireText(request.currentPassword(), "currentPassword");
        requireText(request.newPassword(), "newPassword");
        if (request.newPassword().length() < MIN_PASSWORD_LENGTH) {
            throw new IllegalArgumentException(
                "newPassword must be at least " + MIN_PASSWORD_LENGTH + " characters");
        }
        if (request.newPassword().equals(request.currentPassword())) {
            throw new IllegalArgumentException("newPassword must differ from the current password");
        }

        Employee employee = signedIn(caller);
        requireCurrentPassword(employee, request.currentPassword());
        employee.setPassword(passwordEncoder.encode(request.newPassword()));
        directory.save(employee);
        return respond(employee);
    }

    /**
     * Issues a token for an employee and packages it with their summary.
     *
     * @param employee the employee the token is for, with their current password digest
     * @return the sign-in response
     */
    private LoginResponse respond(Employee employee) {
        EmployeeSummary user = EmployeeSummary.from(employee);
        Role role = user.role();
        TokenService.IssuedToken issued = tokenService.issue(
            user.employeeId(), user.email(), role, employee.getPassword());
        return new LoginResponse(issued.token(), issued.expiresAt(), user);
    }

    /**
     * Loads the signed-in employee in full. The caller deliberately carries no password digest, so
     * anything that needs one reads the employee again.
     *
     * @param caller the signed-in employee
     * @return the employee as stored now
     * @throws UnauthorizedException if they have been deleted since the interceptor looked
     */
    private Employee signedIn(Caller caller) {
        return directory.findById(caller.employeeId())
            .orElseThrow(() -> new UnauthorizedException("Your account no longer exists"));
    }

    private void requireCurrentPassword(Employee employee, String password) {
        if (!passwordEncoder.matches(password, employee.getPassword())) {
            throw new ForbiddenException("Current password is incorrect");
        }
    }

    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
    }
}
