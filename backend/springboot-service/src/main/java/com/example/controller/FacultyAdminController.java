package com.example.controller;

import com.example.auth.AllowAnonymous;
import com.example.auth.Caller;
import com.example.auth.CompanyAccounts;
import com.example.auth.EmployeeDirectory;
import com.example.auth.UnauthorizedException;
import com.example.classes.Employee;
import com.example.classes.Engineer;
import com.example.classes.FacultyAdmin;
import com.example.model.CreateEmployeeRequest;
import com.example.model.EngineerResponse;
import com.example.model.FacultyAdminResponse;
import com.example.repos.EmployeeRepository;
import com.example.repos.EngineerRepository;
import com.example.repos.FacultyAdminRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Faculty admin endpoints, including the engineers each admin manages.
 *
 * Reading is open to anyone signed in. Making a faculty admin, by creating one or by promoting an
 * employee or engineer, takes the default admin ({@value CompanyAccounts#DEFAULT_ADMIN_EMAIL}),
 * except for the very first admin, and an admin's team is changed only by that admin. Mapped on two
 * base paths for the reason explained in {@link ApiPaths}.
 */
@RestController
@RequestMapping({ApiPaths.FACULTY_ADMINS, ApiPaths.CLOUD_PREFIX + ApiPaths.FACULTY_ADMINS})
public class FacultyAdminController {

    /** Stores the faculty admins. */
    private final FacultyAdminRepository facultyAdminRepository;

    /** Stores the engineers, needed to resolve the ids in assignment requests. */
    private final EngineerRepository engineerRepository;

    /** Stores the plain employees, where a promoted employee is removed from. */
    private final EmployeeRepository employeeRepository;

    /** Hashes incoming passwords so no plaintext is ever stored. */
    private final PasswordEncoder passwordEncoder;

    /** Every kind of employee, for the id-uniqueness check and for finding whom to promote. */
    private final EmployeeDirectory directory;

    /**
     * Creates the controller.
     *
     * @param facultyAdminRepository the repository holding faculty admins
     * @param engineerRepository the repository holding engineers
     * @param employeeRepository the repository holding plain employees
     * @param passwordEncoder the encoder applied to passwords on the way in
     * @param directory every kind of employee, for the id-uniqueness check and promotions
     */
    public FacultyAdminController(
        FacultyAdminRepository facultyAdminRepository,
        EngineerRepository engineerRepository,
        EmployeeRepository employeeRepository,
        PasswordEncoder passwordEncoder,
        EmployeeDirectory directory
    ) {
        this.facultyAdminRepository = facultyAdminRepository;
        this.engineerRepository = engineerRepository;
        this.employeeRepository = employeeRepository;
        this.passwordEncoder = passwordEncoder;
        this.directory = directory;
    }

    /**
     * Creates a faculty admin.
     *
     * Bootstrapping: while no faculty admin exists, nobody can sign in, so this one call is allowed
     * without a token. The moment the first admin exists the door closes, and every further admin
     * is created by the default admin, {@value CompanyAccounts#DEFAULT_ADMIN_EMAIL}. That is what
     * makes a freshly deployed service safe to leave reachable: the first person to call this owns
     * it, and nobody after them can. In practice {@code DefaultAdminSeeder} has already created the
     * default admin by the time any request arrives.
     *
     * Any facultyAdminId on the request is ignored; an admin is not managed by another admin.
     *
     * @param request the credentials and employee id for the new admin
     * @param caller the signed-in employee, absent only on the bootstrap call
     * @param httpRequest the current request, used to build the Location header
     * @return 201 with the created admin, 400 for a malformed body or an email outside
     *     {@value CompanyAccounts#EMAIL_DOMAIN}, 401 without a token once an admin exists, 403 for
     *     anyone but the default admin, or 409 if the employee id or email is taken
     */
    @PostMapping
    @AllowAnonymous
    public ResponseEntity<FacultyAdminResponse> create(
        @RequestBody CreateEmployeeRequest request,
        Optional<Caller> caller,
        HttpServletRequest httpRequest
    ) {
        if (!facultyAdminRepository.findAll().isEmpty()) {
            caller.orElseThrow(() -> new UnauthorizedException("Sign in to continue"))
                .requireDefaultAdmin("create a faculty admin");
        }
        validate(request);
        CompanyAccounts.requireCompanyEmail(request.email());
        if (directory.existsById(request.employeeId())) {
            throw new IllegalStateException("Employee " + request.employeeId() + " already exists");
        }
        requireUnusedEmail(directory, request.email());

        // Hashed here, at the edge, so the plaintext never reaches the domain object or the store.
        FacultyAdmin created = facultyAdminRepository.save(new FacultyAdmin(
            request.email(),
            passwordEncoder.encode(request.password()),
            request.employeeId()
        ));

        // Built from the request path rather than from the host: inside Lambda the host is the
        // Function URL, not the CloudFront address the caller actually used.
        URI location = URI.create(httpRequest.getRequestURI() + "/" + created.getEmployeeId());
        return ResponseEntity.created(location).body(FacultyAdminResponse.from(created));
    }

    /**
     * Makes an existing plain employee or engineer a faculty admin.
     *
     * Only the default admin may do this. The check comes before the lookup, so anyone else learns
     * nothing from the difference between 403 and 404.
     *
     * The account keeps everything else: id, email, password and the reports it filed or works on.
     * It is the same account with a new role, so its open sessions stay valid (a token is tied to
     * the password, which is unchanged) and the role applies from its next request, since the caller
     * is looked up on every request. An engineer leaves the team they were on, because a faculty
     * admin is managed by nobody.
     *
     * @param employeeId the id of the employee or engineer to promote
     * @param caller the signed-in default admin
     * @return 200 with the new admin; 403 for anyone but the default admin; 404 when nobody has that
     *     id; 409 when they are a faculty admin already
     */
    @PutMapping("/{employeeId}")
    public FacultyAdminResponse promote(@PathVariable String employeeId, Caller caller) {
        caller.requireDefaultAdmin("promote to faculty admin");
        Employee employee = directory.findById(employeeId)
            .orElseThrow(() -> new NoSuchElementException("No employee " + employeeId));
        if (employee instanceof FacultyAdmin) {
            throw new IllegalStateException(employeeId + " is already a faculty admin");
        }
        if (employee instanceof Engineer engineer) {
            // Through the domain, so the old admin's managed set and the engineer's link go together.
            engineer.unassign();
        }

        // Save first, then delete; never the other way round. In PostgreSQL the save is an upsert on
        // the same row, turning it into a FACULTY_ADMIN in place, and the delete then matches nothing
        // because it only deletes rows of the old role. The in-memory stores keep each role apart, so
        // there the delete removes the old entry. Deleting first would really delete the row, and the
        // foreign keys would null out their reports' author and cascade away their assignments.
        // The stored digest is carried over as it is, not hashed again, so the password still works.
        FacultyAdmin promoted = facultyAdminRepository.save(
            new FacultyAdmin(employee.getEmail(), employee.getPassword(), employeeId));
        if (employee instanceof Engineer) {
            engineerRepository.deleteById(employeeId);
        } else {
            employeeRepository.deleteById(employeeId);
        }
        return FacultyAdminResponse.from(promoted);
    }

    /**
     * Lists every faculty admin.
     *
     * @param caller the signed-in employee
     * @return 200 with all admins and the engineers each of them manages
     */
    @GetMapping
    public List<FacultyAdminResponse> list(Caller caller) {
        return facultyAdminRepository.findAll().stream()
            .map(FacultyAdminResponse::from)
            .toList();
    }

    /**
     * Returns a single faculty admin.
     *
     * @param employeeId the admin's employee id
     * @param caller the signed-in employee
     * @return 200 with the admin, or 404 when no admin has that id
     */
    @GetMapping("/{employeeId}")
    public FacultyAdminResponse get(@PathVariable String employeeId, Caller caller) {
        return FacultyAdminResponse.from(requireAdmin(employeeId));
    }

    /**
     * Lists the engineers a faculty admin manages.
     *
     * @param employeeId the admin's employee id
     * @param caller the signed-in employee
     * @return 200 with the managed engineers, empty when the admin manages none, or 404 when no admin
     *     has that id
     */
    @GetMapping("/{employeeId}/engineers")
    public List<EngineerResponse> listEngineers(@PathVariable String employeeId, Caller caller) {
        return requireAdmin(employeeId).getManagedEngineers().stream()
            .map(EngineerResponse::from)
            .toList();
    }

    /**
     * Places an engineer under this admin's management.
     *
     * Only the admin named in the path may do this: a team is changed by the admin who runs it.
     * The check comes before the lookups, so an admin probing another admin's team learns nothing
     * from the difference between 403 and 404.
     *
     * PUT rather than POST because the request names the state it wants and repeating it changes
     * nothing. Note that this moves an engineer who is already managed by a different admin, and
     * answers 200 rather than refusing — the request asked for a state, and that state is now true.
     *
     * @param employeeId the admin's employee id
     * @param engineerEmployeeId the employee id of the engineer to manage
     * @param caller the signed-in faculty admin, who must be the one in the path
     * @return 200 with the updated admin, 403 for anyone but that admin, or 404 when the engineer is
     *     unknown
     */
    @PutMapping("/{employeeId}/engineers/{engineerEmployeeId}")
    public FacultyAdminResponse assignEngineer(
        @PathVariable String employeeId,
        @PathVariable String engineerEmployeeId,
        Caller caller
    ) {
        caller.requireOwnTeam(employeeId, "add engineers to this team");
        FacultyAdmin admin = requireAdmin(employeeId);
        Engineer engineer = requireEngineer(engineerEmployeeId);
        admin.addEngineer(engineer);
        // The link is a column on the engineer's own row, so saving the engineer is what makes the
        // assignment outlive this request.
        engineerRepository.save(engineer);
        return FacultyAdminResponse.from(admin);
    }

    /**
     * Releases an engineer from this admin's management.
     *
     * Answers 409 rather than 404 when the engineer exists but a different admin manages it. The
     * engineer is plainly there, so 404 would be untrue; what is wrong is the caller's picture of who
     * manages whom. Checking here also means the silent no-op inside
     * {@link FacultyAdmin#removeEngineer(Engineer)} never reaches the caller as a misleading 204.
     *
     * @param employeeId the admin's employee id
     * @param engineerEmployeeId the employee id of the engineer to release
     * @param caller the signed-in faculty admin, who must be the one in the path
     * @return 204 when the engineer was released, 403 for anyone but that admin, 404 when the
     *     engineer is unknown, or 409 when another admin manages that engineer
     */
    @DeleteMapping("/{employeeId}/engineers/{engineerEmployeeId}")
    public ResponseEntity<Void> unassignEngineer(
        @PathVariable String employeeId,
        @PathVariable String engineerEmployeeId,
        Caller caller
    ) {
        caller.requireOwnTeam(employeeId, "remove engineers from this team");
        FacultyAdmin admin = requireAdmin(employeeId);
        Engineer engineer = requireEngineer(engineerEmployeeId);
        if (!admin.managesEngineer(engineer)) {
            throw new IllegalStateException(
                "Engineer " + engineerEmployeeId + " is not managed by faculty admin " + employeeId
            );
        }
        admin.removeEngineer(engineer);
        // Clears faculty_admin_id on the engineer's row, the same way assigning sets it.
        engineerRepository.save(engineer);
        return ResponseEntity.noContent().build();
    }

    /**
     * Looks up a faculty admin, or fails.
     *
     * @param employeeId the admin's employee id
     * @return the admin
     * @throws NoSuchElementException if no admin has that id
     */
    private FacultyAdmin requireAdmin(String employeeId) {
        return facultyAdminRepository.findById(employeeId)
            .orElseThrow(() -> new NoSuchElementException("No faculty admin " + employeeId));
    }

    /**
     * Looks up an engineer, or fails.
     *
     * @param employeeId the engineer's employee id
     * @return the engineer
     * @throws NoSuchElementException if no engineer has that id
     */
    private Engineer requireEngineer(String employeeId) {
        return engineerRepository.findById(employeeId)
            .orElseThrow(() -> new NoSuchElementException("No engineer " + employeeId));
    }

    /**
     * Rejects a create request that is missing anything required.
     *
     * Guard clauses rather than bean validation annotations: the validator and its expression
     * language bring a couple of megabytes along, and cold start on a 128 MB function is the scarcest
     * resource this service has.
     *
     * @param request the request to check
     * @throws IllegalArgumentException if any required field is missing or blank
     */
    static void validate(CreateEmployeeRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("A request body is required");
        }
        requireText(request.email(), "email");
        requireText(request.password(), "password");
        requireText(request.employeeId(), "employeeId");
    }

    /**
     * Rejects an email address any kind of account already has, ignoring case.
     *
     * The employee table's UNIQUE constraint would refuse it anyway, but case-sensitively and as a
     * 500; this makes it a 409 that sign-in, which matches ignoring case, agrees with.
     *
     * @param directory every kind of employee
     * @param email the address to check
     * @throws IllegalStateException if an account already has it
     */
    static void requireUnusedEmail(EmployeeDirectory directory, String email) {
        if (directory.findByEmail(email.trim()).isPresent()) {
            throw new IllegalStateException("An account with email " + email.trim() + " already exists");
        }
    }

    /**
     * Rejects a missing or blank field.
     *
     * @param value the value to check
     * @param field the field name to name in the error message
     * @throws IllegalArgumentException if the value is null or blank
     */
    private static void requireText(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(field + " must not be blank");
        }
    }
}
