package com.example.auth;

import com.example.classes.Employee;
import com.example.classes.Engineer;
import com.example.classes.FacultyAdmin;
import com.example.classes.Role;
import com.example.repos.EmployeeRepository;
import com.example.repos.EngineerRepository;
import com.example.repos.FacultyAdminRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Looks employees up, and saves one back, without caring which kind they are.
 *
 * Plain employees, engineers and faculty admins live in three repositories keyed by employee id.
 * Signing in needs to find one person by email, and authorising a report needs to know which team
 * several people are on, so this joins the stores behind one lookup. Changing a password needs to
 * write back whoever signed in, so {@link #save} picks the matching store the same way.
 */
@Component
public class EmployeeDirectory {

    /** Stores the plain employees. */
    private final EmployeeRepository employeeRepository;

    /** Stores the engineers. */
    private final EngineerRepository engineerRepository;

    /** Stores the faculty admins. */
    private final FacultyAdminRepository facultyAdminRepository;

    /**
     * Creates the directory.
     *
     * @param employeeRepository the repository holding plain employees
     * @param engineerRepository the repository holding engineers
     * @param facultyAdminRepository the repository holding faculty admins
     */
    public EmployeeDirectory(
        EmployeeRepository employeeRepository,
        EngineerRepository engineerRepository,
        FacultyAdminRepository facultyAdminRepository
    ) {
        this.employeeRepository = employeeRepository;
        this.engineerRepository = engineerRepository;
        this.facultyAdminRepository = facultyAdminRepository;
    }

    /**
     * Finds an employee of any kind by id.
     *
     * @param employeeId the id to look for
     * @return the employee, or empty when nobody has that id
     */
    public Optional<Employee> findById(String employeeId) {
        Optional<Employee> admin = facultyAdminRepository.findById(employeeId).map(a -> a);
        if (admin.isPresent()) {
            return admin;
        }
        Optional<Employee> engineer = engineerRepository.findById(employeeId).map(e -> e);
        if (engineer.isPresent()) {
            return engineer;
        }
        return employeeRepository.findById(employeeId);
    }

    /**
     * Saves an employee of any kind to the repository that holds their kind.
     *
     * Each repository writes only that employee's own row, so saving an admin leaves their
     * engineers alone, and an engineer keeps the admin they were loaded with.
     *
     * @param employee the employee to save, as previously loaded from this directory
     */
    public void save(Employee employee) {
        switch (Role.of(employee)) {
            case FACULTY_ADMIN -> facultyAdminRepository.save((FacultyAdmin) employee);
            case ENGINEER -> engineerRepository.save((Engineer) employee);
            case EMPLOYEE -> employeeRepository.save(employee);
        }
    }

    /**
     * Reports whether any kind of employee already holds an id, which must be unique across all of
     * them because they share one table.
     *
     * @param employeeId the id to check
     * @return true when the id is taken
     */
    public boolean existsById(String employeeId) {
        return facultyAdminRepository.existsById(employeeId)
            || engineerRepository.existsById(employeeId)
            || employeeRepository.existsById(employeeId);
    }

    /**
     * Finds an employee of any kind by email address, ignoring case.
     *
     * A scan rather than an indexed lookup: the repositories key on id, and at this service's size a
     * scan on sign-in is cheaper than a second index to keep in step.
     *
     * @param email the address to look for
     * @return the employee, or empty when nobody has that address
     */
    public Optional<Employee> findByEmail(String email) {
        if (email == null) {
            return Optional.empty();
        }
        return snapshot().all().stream()
            .filter(employee -> email.equalsIgnoreCase(employee.getEmail()))
            .findFirst();
    }

    /**
     * Reads every employee once, for code that will ask about many of them.
     *
     * @return a snapshot of the directory as of now
     */
    public Snapshot snapshot() {
        Map<String, Employee> byId = new HashMap<>();
        employeeRepository.findAll().forEach(employee -> byId.put(employee.getEmployeeId(), employee));
        facultyAdminRepository.findAll().forEach(admin -> byId.put(admin.getEmployeeId(), admin));
        engineerRepository.findAll().forEach(engineer -> byId.put(engineer.getEmployeeId(), engineer));
        return new Snapshot(byId);
    }

    /**
     * Every employee as of one moment, so a request that resolves many ids issues a fixed number
     * of queries rather than one per id.
     */
    public static final class Snapshot {

        /** Employees by id. */
        private final Map<String, Employee> byId;

        /**
         * Creates the snapshot.
         *
         * @param byId employees by id
         */
        Snapshot(Map<String, Employee> byId) {
            this.byId = byId;
        }

        /**
         * Returns everyone in the snapshot.
         *
         * @return every employee
         */
        public List<Employee> all() {
            return List.copyOf(byId.values());
        }

        /**
         * Finds one employee.
         *
         * @param employeeId the id to look for
         * @return the employee, or empty when the id is null or unknown
         */
        public Optional<Employee> find(String employeeId) {
            return employeeId == null ? Optional.empty() : Optional.ofNullable(byId.get(employeeId));
        }

        /**
         * Returns the team an employee belongs to: an admin's own id, or the admin managing an
         * engineer.
         *
         * @param employeeId the employee
         * @return the team's faculty admin id, or empty when the employee is unknown or unmanaged
         */
        public Optional<String> teamOf(String employeeId) {
            return find(employeeId).flatMap(employee -> {
                if (employee instanceof FacultyAdmin) {
                    return Optional.of(employee.getEmployeeId());
                }
                if (employee instanceof Engineer engineer) {
                    return Optional.ofNullable(engineer.getFacultyAdminId());
                }
                return Optional.empty();
            });
        }

        /**
         * Reports whether an employee exists but belongs to no team: a plain employee, or an
         * engineer nobody manages.
         *
         * @param employeeId the employee
         * @return true when they are known and on no team; false when unknown or on a team
         */
        public boolean onNoTeam(String employeeId) {
            return find(employeeId).isPresent() && teamOf(employeeId).isEmpty();
        }

        /**
         * Returns the engineers managed by one faculty admin.
         *
         * @param facultyAdminId the admin
         * @return the engineers on that admin's team
         */
        public List<Engineer> engineersOf(String facultyAdminId) {
            return byId.values().stream()
                .filter(Engineer.class::isInstance)
                .map(Engineer.class::cast)
                .filter(engineer -> facultyAdminId != null
                    && facultyAdminId.equals(engineer.getFacultyAdminId()))
                .toList();
        }
    }
}
