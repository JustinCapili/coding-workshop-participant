package com.example.classes;

/**
 * What somebody may do to one particular report.
 *
 * Declared weakest first, because the ordinal is what {@link #atLeast(AccessLevel)} compares. Adding
 * a level in the middle of this list changes every comparison, so new levels belong at the position
 * their power warrants and nowhere else.
 *
 * Two of these never appear in the database. NONE exists so the policy that decides a caller's level
 * is total and never returns null. ADMIN is excluded by the CHECK constraint on the grant table
 * because admin rights come from being a faculty admin, not from a grant — otherwise a grant could
 * hand out the power to issue further grants.
 */
public enum AccessLevel {

    /** No access at all. Never stored; the absence of a grant is expressed this way. */
    NONE,

    /** May read the report. The level a grant carries unless a higher one is chosen. */
    VIEWER,

    /** May read and edit the report, and submit it for review. */
    CONTRIBUTOR,

    /** May read, edit, delete, and move the report through the rest of its lifecycle. */
    MANAGER,

    /** Everything, on every report. Comes from being a faculty admin; never stored as a grant. */
    ADMIN;

    /**
     * Reports whether this level is at least as strong as the one required.
     *
     * @param required the level the operation demands
     * @return true when this level meets or exceeds it
     */
    public boolean atLeast(AccessLevel required) {
        return this.ordinal() >= required.ordinal();
    }
}
