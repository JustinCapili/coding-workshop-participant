package com.example.repos;

import com.example.classes.Engineer;

/**
 * Stores engineers, keyed by employee id.
 *
 * An interface rather than a class so the storage can be chosen at runtime: JdbcEngineerRepository
 * against PostgreSQL normally, InMemoryEngineerRepository under the test profile. The controllers
 * depend on this type and never learn which one they were given.
 *
 * There is no separate repository for plain employees or for users in general. A second store holding
 * the same rows would be a second source of truth, and the two would drift apart the first time
 * something was deleted from one and not the other.
 */
public interface EngineerRepository extends Repository<Engineer> {
}
