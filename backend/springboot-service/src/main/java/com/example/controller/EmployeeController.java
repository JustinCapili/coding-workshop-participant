package com.example.controller;

import com.example.auth.Caller;
import com.example.auth.EmployeeDirectory;
import com.example.classes.Employee;
import com.example.classes.Engineer;
import com.example.classes.FacultyAdmin;
import com.example.classes.Role;
import com.example.model.EmployeeSummary;
import com.example.model.EngineerResponse;
import com.example.repos.EmployeeRepository;
import com.example.repos.EngineerRepository;
import com.example.repos.FacultyAdminRepository;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Plain employee endpoints: staff who file reports and are neither engineers nor faculty admins.
 *
 * There is no create here. Plain employees make their own accounts through
 * {@code POST /auth/register}. A plain employee is on no team, so no single admin owns one: anyone
 * signed in may read them, and any faculty admin may delete one, or promote one to an engineer on
 * their own team. Mapped on two base paths for the reason explained in {@link ApiPaths}.
 */
@RestController
@RequestMapping({ApiPaths.EMPLOYEES, ApiPaths.CLOUD_PREFIX + ApiPaths.EMPLOYEES})
public class EmployeeController {

    /** Stores the plain employees. */
    private final EmployeeRepository employeeRepository;

    /** Stores the engineers, where a promoted employee ends up. */
    private final EngineerRepository engineerRepository;

    /** Stores the faculty admins, whose team a promoted employee joins. */
    private final FacultyAdminRepository facultyAdminRepository;

    /** Finds an id of any kind, to say why a promotion was refused. */
    private final EmployeeDirectory directory;

    /**
     * Creates the controller.
     *
     * @param employeeRepository the repository holding plain employees
     * @param engineerRepository the repository holding engineers
     * @param facultyAdminRepository the repository holding faculty admins
     * @param directory the lookup across every kind of employee
     */
    public EmployeeController(
        EmployeeRepository employeeRepository,
        EngineerRepository engineerRepository,
        FacultyAdminRepository facultyAdminRepository,
        EmployeeDirectory directory
    ) {
        this.employeeRepository = employeeRepository;
        this.engineerRepository = engineerRepository;
        this.facultyAdminRepository = facultyAdminRepository;
        this.directory = directory;
    }

    /**
     * Lists every plain employee.
     *
     * @param caller the signed-in employee
     * @return 200 with the employees
     */
    @GetMapping
    public List<EmployeeSummary> list(Caller caller) {
        return employeeRepository.findAll().stream()
            .map(EmployeeSummary::from)
            .toList();
    }

    /**
     * Returns a single plain employee.
     *
     * @param employeeId the employee's id
     * @param caller the signed-in employee
     * @return 200 with the employee, or 404 when no plain employee has that id
     */
    @GetMapping("/{employeeId}")
    public EmployeeSummary get(@PathVariable String employeeId, Caller caller) {
        return EmployeeSummary.from(requireEmployee(employeeId));
    }

    /**
     * Deletes a plain employee. Reports they filed stay, with no author.
     *
     * @param employeeId the employee's id
     * @param caller the signed-in faculty admin
     * @return 204 when deleted, 403 for anyone but a faculty admin, or 404 when no plain employee has
     *     that id
     */
    @DeleteMapping("/{employeeId}")
    public ResponseEntity<Void> delete(@PathVariable String employeeId, Caller caller) {
        caller.requireFacultyAdmin("delete employees");
        requireEmployee(employeeId);
        employeeRepository.deleteById(employeeId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Makes a plain employee an engineer on the calling faculty admin's team.
     *
     * The employee keeps everything else: id, email, password and the reports they filed. It is the
     * same account with a new role, so their open sessions stay valid (a token is tied to the
     * password, which is unchanged) and the role applies from their next request, since the caller
     * is looked up on every request.
     *
     * @param employeeId the plain employee's id
     * @param caller the signed-in faculty admin
     * @return 200 with the new engineer; 403 for anyone but a faculty admin; 404 when nobody has that
     *     id; 409 when it belongs to an engineer or a faculty admin already
     */
    @PostMapping("/{employeeId}/promote")
    public EngineerResponse promote(@PathVariable String employeeId, Caller caller) {
        caller.requireFacultyAdmin("promote employees");
        Employee employee = employeeRepository.findById(employeeId)
            .orElseThrow(() -> notPromotable(employeeId));

        // The stored digest is carried over as it is, not hashed again, so the password still works.
        Engineer engineer = new Engineer(employee.getEmail(), employee.getPassword(), employeeId);
        // The caller is this admin, so the lookup cannot fail unless they were deleted between the
        // interceptor running and now.
        FacultyAdmin admin = facultyAdminRepository.findById(caller.employeeId())
            .orElseThrow(() -> new NoSuchElementException("No faculty admin " + caller.employeeId()));
        admin.addEngineer(engineer);

        // Save first, then delete; never the other way round. In PostgreSQL the save is an upsert on
        // the same row, turning it into an ENGINEER in place, and the delete then matches nothing
        // because it only deletes EMPLOYEE rows. The in-memory stores keep each role apart, so there
        // the delete removes the old entry. Deleting first would really delete the row, and the
        // foreign keys would null out their reports' author and cascade away their requests.
        Engineer promoted = engineerRepository.save(engineer);
        employeeRepository.deleteById(employeeId);
        return EngineerResponse.from(promoted);
    }

    /**
     * Explains why an id that is not a plain employee's cannot be promoted.
     *
     * @param employeeId the id asked for
     * @return a 409 when it belongs to an engineer or a faculty admin, otherwise a 404
     */
    private RuntimeException notPromotable(String employeeId) {
        Optional<Employee> other = directory.findById(employeeId);
        if (other.isEmpty()) {
            return new NoSuchElementException("No employee " + employeeId);
        }
        return new IllegalStateException(employeeId
            + (Role.of(other.get()) == Role.ENGINEER ? " is already an engineer" : " is a faculty admin"));
    }

    /**
     * Looks up a plain employee, or fails.
     *
     * @param employeeId the employee's id
     * @return the employee
     * @throws NoSuchElementException if no plain employee has that id
     */
    private Employee requireEmployee(String employeeId) {
        return employeeRepository.findById(employeeId)
            .orElseThrow(() -> new NoSuchElementException("No employee " + employeeId));
    }
}
