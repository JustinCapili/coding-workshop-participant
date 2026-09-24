package com.example.repos;

import java.util.List;
import java.util.Optional;

/**
 * Storage for entities keyed by a string identifier.
 *
 * Deliberately small: enough to back the REST layer, and no more. Swapping the in-memory
 * implementation for one backed by PostgreSQL or DocumentDB means writing another implementation of
 * this interface, with nothing above it changing.
 *
 * @param <T> the type of entity stored
 */
public interface Repository<T> {

    /**
     * Inserts the entity, or replaces the existing one with the same identifier.
     *
     * @param entity the entity to store
     * @return the stored entity
     */
    T save(T entity);

    /**
     * Looks up a single entity.
     *
     * @param id the identifier to look for, may be null
     * @return the entity, or empty when no entity has that identifier
     */
    Optional<T> findById(String id);

    /**
     * Returns every stored entity.
     *
     * @return an immutable snapshot of all entities, empty when none are stored
     */
    List<T> findAll();

    /**
     * Removes a single entity.
     *
     * @param id the identifier to remove, may be null
     * @return true when an entity was removed, false when no entity had that identifier
     */
    boolean deleteById(String id);

    /**
     * Reports whether an entity with the given identifier is stored.
     *
     * @param id the identifier to check, may be null
     * @return true when an entity has that identifier, false otherwise
     */
    boolean existsById(String id);

    /**
     * Removes every stored entity.
     *
     * Present mainly so that tests can reset a repository between methods: the repositories are
     * singletons, so without this, state from one test leaks into the next in whatever order they run.
     */
    void deleteAll();
}
