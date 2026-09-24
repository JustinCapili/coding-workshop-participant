package com.example.classes;

import java.util.Objects;

/**
 * An engineer, optionally managed by a {@link FacultyAdmin}.
 *
 * This is the non-owning side of the management relationship. An engineer knows which faculty admin
 * manages it, but it does not maintain that link itself — {@link FacultyAdmin#addEngineer(Engineer)}
 * and {@link FacultyAdmin#removeEngineer(Engineer)} are the only two methods that change it, and they
 * update both sides together so the two can never disagree.
 *
 * {@link #assignTo(FacultyAdmin)} and {@link #unassign()} exist so that code reading engineer-first
 * does not have to invert the call; both simply delegate to the owning side.
 */
public class Engineer extends Employee {

    /** The faculty admin managing this engineer, or null when the engineer is unassigned. */
    private FacultyAdmin facultyAdmin;

    /**
     * Creates an unassigned engineer.
     *
     * Use {@link #assignTo(FacultyAdmin)} or {@link FacultyAdmin#addEngineer(Engineer)} to place the
     * engineer under a faculty admin.
     *
     * @param email the engineer's email address
     * @param password the engineer's password
     * @param employeeId the identifier for this engineer, unique across all staff
     */
    public Engineer(String email, String password, String employeeId) {
        super(email, password, employeeId);
    }

    /**
     * Returns the faculty admin managing this engineer.
     *
     * @return the managing faculty admin, or null when this engineer is unassigned
     */
    public FacultyAdmin getFacultyAdmin() {
        return facultyAdmin;
    }

    /**
     * Returns the employee id of the faculty admin managing this engineer.
     *
     * A null-safe convenience for callers that want the identifier rather than the object, such as
     * the response records in {@code com.example.model}.
     *
     * @return the managing faculty admin's employee id, or null when this engineer is unassigned
     */
    public String getFacultyAdminId() {
        return facultyAdmin == null ? null : facultyAdmin.getEmployeeId();
    }

    /**
     * Reports whether this engineer is currently managed by a faculty admin.
     *
     * @return true when a faculty admin manages this engineer, false otherwise
     */
    public boolean isAssigned() {
        return facultyAdmin != null;
    }

    /**
     * Places this engineer under the given faculty admin.
     *
     * Equivalent to {@code facultyAdmin.addEngineer(this)}. If another faculty admin currently manages
     * this engineer, that admin releases it first, so an engineer is never managed by two admins.
     *
     * @param facultyAdmin the faculty admin that should manage this engineer
     * @throws NullPointerException if facultyAdmin is null
     */
    public void assignTo(FacultyAdmin facultyAdmin) {
        Objects.requireNonNull(facultyAdmin, "facultyAdmin must not be null");
        facultyAdmin.addEngineer(this);
    }

    /**
     * Removes this engineer from whichever faculty admin currently manages it.
     *
     * Does nothing when the engineer is already unassigned.
     */
    public void unassign() {
        if (facultyAdmin != null) {
            facultyAdmin.removeEngineer(this);
        }
    }

    /**
     * Sets the back-reference to the managing faculty admin.
     *
     * Package-private on purpose: {@link FacultyAdmin} is the owning side of the relationship and is
     * the only type allowed to touch this field. Because the controllers and repositories live in
     * other packages, the compiler enforces that every change to the link goes through
     * {@link FacultyAdmin#addEngineer(Engineer)} or {@link FacultyAdmin#removeEngineer(Engineer)}.
     *
     * This is a plain field assignment with no logic, which is what makes the two-way update safe:
     * the owning side calls into here, and nothing calls back out, so the setters cannot recurse.
     *
     * @param facultyAdmin the managing faculty admin, or null to clear the link
     */
    void setFacultyAdmin(FacultyAdmin facultyAdmin) {
        this.facultyAdmin = facultyAdmin;
    }
}
