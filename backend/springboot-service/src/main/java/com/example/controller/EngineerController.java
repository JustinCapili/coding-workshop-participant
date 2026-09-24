package com.example.controller;

import com.example.auth.Caller;
import com.example.auth.CompanyAccounts;
import com.example.auth.EmployeeDirectory;
import com.example.auth.ForbiddenException;
import com.example.classes.Engineer;
import com.example.classes.FacultyAdmin;
import com.example.model.CreateEmployeeRequest;
import com.example.model.EngineerResponse;
import com.example.repos.EngineerRepository;
import com.example.repos.FacultyAdminRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Engineer endpoints.
 *
 * Reading is open to anyone signed in. Engineers are created and deleted by faculty admins, and
 * only within their own team. Mapped on two base paths for the reason explained in {@link ApiPaths}.
 */
@RestController
@RequestMapping({ApiPaths.ENGINEERS, ApiPaths.CLOUD_PREFIX + ApiPaths.ENGINEERS})
public class EngineerController {

    /** Stores the engineers. */
    private final EngineerRepository engineerRepository;

    /** Stores the faculty admins, needed to resolve an assignment given at creation time. */
    private final FacultyAdminRepository facultyAdminRepository;

    /** Hashes incoming passwords so no plaintext is ever stored. */
    private final PasswordEncoder passwordEncoder;

    /** Every kind of employee, for the id-uniqueness check. */
    private final EmployeeDirectory directory;

    /**
     * Creates the controller.
     *
     * @param engineerRepository the repository holding engineers
     * @param facultyAdminRepository the repository holding faculty admins
     * @param passwordEncoder the encoder applied to passwords on the way in
     * @param directory every kind of employee, for the id-uniqueness check
     */
    public EngineerController(
        EngineerRepository engineerRepository,
        FacultyAdminRepository facultyAdminRepository,
        PasswordEncoder passwordEncoder,
        EmployeeDirectory directory
    ) {
        this.engineerRepository = engineerRepository;
        this.facultyAdminRepository = facultyAdminRepository;
        this.passwordEncoder = passwordEncoder;
        this.directory = directory;
    }

    /**
     * Creates an engineer, optionally under a faculty admin.
     *
     * Only a faculty admin may do this, and when the request names a team it must be the caller's
     * own: an admin provisions their engineers, not somebody else's. Leaving facultyAdminId out
     * creates an unmanaged engineer, who any admin can later claim through
     * {@code PUT /faculty-admins/{id}/engineers/{engineerId}}.
     *
     * When the request names a faculty admin, the engineer is placed under that admin before being
     * stored, so an engineer is never briefly visible in a state the request did not ask for.
     *
     * @param request the credentials and employee id for the new engineer, optionally naming a
     *     managing faculty admin
     * @param caller the signed-in faculty admin
     * @param httpRequest the current request, used to build the Location header
     * @return 201 with the created engineer, 400 for a malformed body or an email outside
     *     {@value CompanyAccounts#EMAIL_DOMAIN}, 403 for an engineer or for an admin naming another
     *     admin's team, or 409 if the employee id or email is taken
     */
    @PostMapping
    public ResponseEntity<EngineerResponse> create(
        @RequestBody CreateEmployeeRequest request,
        Caller caller,
        HttpServletRequest httpRequest
    ) {
        caller.requireFacultyAdmin("create engineers");
        FacultyAdminController.validate(request);
        CompanyAccounts.requireCompanyEmail(request.email());
        String facultyAdminId = request.facultyAdminId();
        boolean managed = facultyAdminId != null && !facultyAdminId.isBlank();
        if (managed) {
            caller.requireOwnTeam(facultyAdminId, "add engineers to this team");
        }
        if (directory.existsById(request.employeeId())) {
            throw new IllegalStateException("Employee " + request.employeeId() + " already exists");
        }
        FacultyAdminController.requireUnusedEmail(directory, request.email());

        // Hashed here, at the edge, so the plaintext never reaches the domain object or the store.
        Engineer engineer = new Engineer(
            request.email(),
            passwordEncoder.encode(request.password()),
            request.employeeId()
        );

        if (managed) {
            // The caller is this admin, so the lookup cannot fail unless they were deleted
            // between the interceptor running and now.
            FacultyAdmin admin = facultyAdminRepository.findById(facultyAdminId)
                .orElseThrow(() -> new NoSuchElementException("No faculty admin " + facultyAdminId));
            admin.addEngineer(engineer);
        }

        Engineer created = engineerRepository.save(engineer);
        URI location = URI.create(httpRequest.getRequestURI() + "/" + created.getEmployeeId());
        return ResponseEntity.created(location).body(EngineerResponse.from(created));
    }

    /**
     * Lists engineers, optionally only those managed by one faculty admin.
     *
     * @param facultyAdminId the employee id of a faculty admin to filter by, null for every engineer
     * @param caller the signed-in employee
     * @return 200 with the matching engineers
     */
    @GetMapping
    public List<EngineerResponse> list(
        @RequestParam(required = false) String facultyAdminId,
        Caller caller
    ) {
        return engineerRepository.findAll().stream()
            .filter(engineer ->
                facultyAdminId == null || facultyAdminId.equals(engineer.getFacultyAdminId()))
            .map(EngineerResponse::from)
            .toList();
    }

    /**
     * Returns a single engineer.
     *
     * @param employeeId the engineer's employee id
     * @param caller the signed-in employee
     * @return 200 with the engineer, or 404 when no engineer has that id
     */
    @GetMapping("/{employeeId}")
    public EngineerResponse get(@PathVariable String employeeId, Caller caller) {
        return EngineerResponse.from(requireEngineer(employeeId));
    }

    /**
     * Deletes an engineer.
     *
     * The caller must be the faculty admin managing them. An unmanaged engineer belongs to no team,
     * so any faculty admin may delete one; otherwise nobody could.
     *
     * The engineer is released from its faculty admin first. Skipping that would leave the admin
     * holding a reference to someone who no longer exists, and the admin's engineer list would keep
     * reporting them.
     *
     * @param employeeId the engineer's employee id
     * @param caller the signed-in faculty admin
     * @return 204 when the engineer was deleted, 403 for an engineer or for an admin of another
     *     team, or 404 when no engineer has that id
     */
    @DeleteMapping("/{employeeId}")
    public ResponseEntity<Void> delete(@PathVariable String employeeId, Caller caller) {
        caller.requireFacultyAdmin("delete engineers");
        Engineer engineer = requireEngineer(employeeId);
        String managedBy = engineer.getFacultyAdminId();
        if (managedBy != null && !caller.is(managedBy)) {
            throw new ForbiddenException(
                "Only faculty admin " + managedBy + " can delete engineer " + employeeId);
        }
        engineer.unassign();
        engineerRepository.deleteById(employeeId);
        return ResponseEntity.noContent().build();
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
}
