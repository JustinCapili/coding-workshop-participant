package com.example.classes;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * A faculty admin, who tracks the engineers they manage.
 *
 * This is the owning side of the management relationship. {@link #addEngineer(Engineer)} and
 * {@link #removeEngineer(Engineer)} are the only two methods anywhere that change the link, and each
 * updates both this admin's set and the engineer's back-reference, so the two directions cannot drift
 * apart.
 *
 * A LinkedHashSet is used rather than a list so that adding the same engineer twice is naturally a
 * no-op while iteration order stays predictable. Membership is decided by employee id, because
 * {@link Employee} compares that way — which matters here, since engineers loaded from the database
 * arrive as new objects every time and would otherwise pile up as duplicates.
 */
public class FacultyAdmin extends Employee {

    /**
     * The engineers this admin manages.
     *
     * Private and final: exposing this set, or the array it replaced, would let callers add an
     * engineer without setting its back-reference, which is exactly the inconsistency the two methods
     * below exist to prevent.
     */
    private final Set<Engineer> managedEngineers = new LinkedHashSet<>();

    /**
     * Creates a faculty admin who manages no engineers yet.
     *
     * @param email the admin's email address
     * @param password the admin's password
     * @param employeeId the identifier for this admin, unique across all staff
     */
    public FacultyAdmin(String email, String password, String employeeId) {
        super(email, password, employeeId);
    }

    /**
     * Returns the engineers this admin manages.
     *
     * The returned list is an immutable snapshot, not a live view. A view would throw
     * ConcurrentModificationException if anything added an engineer while a caller iterated it, and
     * would appear to mutate underneath a caller holding what looks like an unmodifiable collection.
     *
     * Because equals and hashCode are not overridden, membership is by object identity. That is
     * deliberate. If a future change makes hashCode read a mutable field such as the email address,
     * every engineer already sitting in the backing set becomes unreachable the moment that field
     * changes: the hash no longer matches the bucket it was filed under, so contains returns false
     * for an engineer that is demonstrably present, remove silently fails, and addEngineer cheerfully
     * stores a duplicate. Keeping identity semantics, and keeping employeeId final, avoids that.
     *
     * @return an immutable snapshot of the managed engineers, empty when none are managed
     */
    public List<Engineer> getManagedEngineers() {
        return List.copyOf(managedEngineers);
    }

    /**
     * Reports whether this admin manages the given engineer.
     *
     * @param engineer the engineer to check, may be null
     * @return true when this admin manages that engineer, false when it does not or when engineer is null
     */
    public boolean managesEngineer(Engineer engineer) {
        return engineer != null && managedEngineers.contains(engineer);
    }

    /**
     * Returns how many engineers this admin manages.
     *
     * @return the number of managed engineers
     */
    public int getManagedEngineerCount() {
        return managedEngineers.size();
    }

    /**
     * Places the given engineer under this admin's management.
     *
     * Calling this repeatedly with the same engineer is a no-op. If another admin currently manages
     * the engineer, that admin releases it first, so the engineer is never held by two admins at once
     * — note that the release has to happen before the back-reference is set, because releasing
     * clears it.
     *
     * @param engineer the engineer to manage
     * @throws NullPointerException if engineer is null
     */
    public void addEngineer(Engineer engineer) {
        Objects.requireNonNull(engineer, "engineer must not be null");
        if (managedEngineers.contains(engineer)) {
            return;
        }
        FacultyAdmin currentAdmin = engineer.getFacultyAdmin();
        // Compared by id rather than by reference: after a read from the database this admin and the
        // engineer's current admin can be two objects describing the same person.
        if (currentAdmin != null && !this.equals(currentAdmin)) {
            currentAdmin.removeEngineer(engineer);
        }
        managedEngineers.add(engineer);
        engineer.setFacultyAdmin(this);
    }

    /**
     * Releases the given engineer from this admin's management.
     *
     * The back-reference is cleared only when the engineer really was managed by this admin. Without
     * that guard, asking one admin to release an engineer managed by a different admin would null out
     * a relationship the caller never named — a corruption that leaves no trace.
     *
     * @param engineer the engineer to release
     * @throws NullPointerException if engineer is null
     */
    public void removeEngineer(Engineer engineer) {
        Objects.requireNonNull(engineer, "engineer must not be null");
        if (managedEngineers.remove(engineer)) {
            engineer.setFacultyAdmin(null);
        }
    }
}
