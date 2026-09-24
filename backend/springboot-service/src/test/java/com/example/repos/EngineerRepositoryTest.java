package com.example.repos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.classes.Engineer;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Checks the in-memory storage behaviour shared by every repository.
 *
 * Exercises the in-memory implementation on purpose. The JDBC one is covered separately, by tests
 * that connect to a real PostgreSQL server, because the behaviour worth checking there is whether
 * rows and foreign keys actually land — which a map cannot tell you.
 */
class EngineerRepositoryTest {

    /** The repository under test. */
    private InMemoryEngineerRepository repository;

    /** An engineer to store. */
    private Engineer engineer;

    @BeforeEach
    void setUp() {
        repository = new InMemoryEngineerRepository();
        engineer = new Engineer("eng@example.com", "pw", "E1");
    }

    @Test
    @DisplayName("a saved engineer can be found again by employee id")
    void saveThenFindById() {
        repository.save(engineer);

        assertThat(repository.findById("E1")).contains(engineer);
        assertThat(repository.existsById("E1")).isTrue();
    }

    @Test
    @DisplayName("an unknown id yields nothing rather than failing")
    void findByUnknownIdIsEmpty() {
        assertThat(repository.findById("nope")).isEmpty();
        assertThat(repository.existsById("nope")).isFalse();
    }

    @Test
    @DisplayName("a null id yields nothing rather than throwing")
    void findByNullIdIsEmpty() {
        assertThat(repository.findById(null)).isEmpty();
        assertThat(repository.existsById(null)).isFalse();
        assertThat(repository.deleteById(null)).isFalse();
    }

    @Test
    @DisplayName("saving over an existing id replaces rather than duplicates")
    void saveWithExistingIdReplaces() {
        repository.save(engineer);
        Engineer replacement = new Engineer("new@example.com", "pw", "E1");

        repository.save(replacement);

        assertThat(repository.findAll()).hasSize(1);
        assertThat(repository.findById("E1")).contains(replacement);
    }

    @Test
    @DisplayName("the list of all engineers cannot be modified")
    void findAllIsImmutable() {
        repository.save(engineer);
        List<Engineer> all = repository.findAll();
        Engineer intruder = new Engineer("x@example.com", "pw", "E9");

        assertThatThrownBy(() -> all.add(intruder))
            .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    @DisplayName("deleting reports whether anything was actually removed")
    void deleteByIdReportsWhatHappened() {
        repository.save(engineer);

        assertThat(repository.deleteById("E1")).isTrue();
        assertThat(repository.deleteById("E1")).isFalse();
        assertThat(repository.findAll()).isEmpty();
    }

    @Test
    @DisplayName("deleteAll empties the repository")
    void deleteAllEmpties() {
        repository.save(engineer);
        repository.save(new Engineer("second@example.com", "pw", "E2"));

        repository.deleteAll();

        assertThat(repository.findAll()).isEmpty();
    }
}
