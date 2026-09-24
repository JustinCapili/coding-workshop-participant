package com.example.repos;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A {@link Repository} that keeps everything in a map in memory.
 *
 * Be clear about what this means on Lambda: the data lives in one execution environment. It survives
 * warm invocations, disappears when that environment is recycled, and is not shared with any other
 * environment handling requests at the same time. A record written by one request can therefore be
 * missing from the very next one. That is a property of the storage, not a bug — it is why this class
 * is a starting point rather than a destination.
 *
 * The map is concurrent because a warm environment can handle overlapping invocations.
 *
 * @param <T> the type of entity stored
 */
public abstract class InMemoryRepository<T> implements Repository<T> {

    /** Entities by identifier. */
    private final Map<String, T> store = new ConcurrentHashMap<>();

    /**
     * Extracts the value used to key the given entity in the store.
     *
     * @param entity the entity to take an identifier from
     * @return the identifier for that entity
     */
    protected abstract String idOf(T entity);

    @Override
    public T save(T entity) {
        Objects.requireNonNull(entity, "entity must not be null");
        store.put(idOf(entity), entity);
        return entity;
    }

    @Override
    public Optional<T> findById(String id) {
        return id == null ? Optional.empty() : Optional.ofNullable(store.get(id));
    }

    /**
     * {@inheritDoc}
     *
     * Returns a copy rather than the map's own value collection, which is a live view: handing that
     * straight to Jackson while another invocation writes to the map is a concurrent modification
     * waiting to happen.
     */
    @Override
    public List<T> findAll() {
        return List.copyOf(store.values());
    }

    @Override
    public boolean deleteById(String id) {
        return id != null && store.remove(id) != null;
    }

    @Override
    public boolean existsById(String id) {
        return id != null && store.containsKey(id);
    }

    @Override
    public void deleteAll() {
        store.clear();
    }
}
