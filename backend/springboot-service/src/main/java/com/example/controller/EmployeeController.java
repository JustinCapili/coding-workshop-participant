package com.example.controller;

import com.example.auth.Caller;
import com.example.classes.Employee;
import com.example.model.EmployeeSummary;
import com.example.repos.EmployeeRepository;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Plain employee endpoints: staff who file reports and are neither engineers nor faculty admins.
 *
 * There is no create here. Plain employees make their own accounts through
 * {@code POST /auth/register}. A plain employee is on no team, so no single admin owns one: anyone
 * signed in may read them, and any faculty admin may delete one. Mapped on two base paths for the
 * reason explained in {@link ApiPaths}.
 */
@RestController
@RequestMapping({ApiPaths.EMPLOYEES, ApiPaths.CLOUD_PREFIX + ApiPaths.EMPLOYEES})
public class EmployeeController {

    /** Stores the plain employees. */
    private final EmployeeRepository employeeRepository;

    /**
     * Creates the controller.
     *
     * @param employeeRepository the repository holding plain employees
     */
    public EmployeeController(EmployeeRepository employeeRepository) {
        this.employeeRepository = employeeRepository;
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
