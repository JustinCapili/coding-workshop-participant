package com.example.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.example.auth.EmployeeDirectory;
import com.example.classes.Engineer;
import com.example.classes.FacultyAdmin;
import com.example.repos.InMemoryEmployeeRepository;
import com.example.repos.InMemoryEngineerRepository;
import com.example.repos.InMemoryFacultyAdminRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * The default admin seeder against in-memory stores, without a Spring context: what it creates on an
 * empty store, how it moves the admin@acme.com account seeded before acme.inc, and what it leaves
 * alone.
 */
class DefaultAdminSeederTest {

    /** Cost 4, the minimum, so the digests are quick to make; the seeder does not care. */
    private final PasswordEncoder passwordEncoder = new BCryptPasswordEncoder(4);

    private final MockEnvironment environment = new MockEnvironment();

    private InMemoryEngineerRepository engineerRepository;

    private InMemoryFacultyAdminRepository facultyAdminRepository;

    private EmployeeDirectory directory;

    private DefaultAdminSeeder seeder;

    @BeforeEach
    void emptyStores() {
        InMemoryEmployeeRepository employeeRepository = new InMemoryEmployeeRepository();
        engineerRepository = new InMemoryEngineerRepository();
        facultyAdminRepository = new InMemoryFacultyAdminRepository();
        directory = new EmployeeDirectory(employeeRepository, engineerRepository, facultyAdminRepository);
        seeder = new DefaultAdminSeeder(environment, directory, facultyAdminRepository, passwordEncoder);
    }

    @Test
    @DisplayName("an empty store gets admin@acme.inc as ADM-001, with the fallback password")
    void seedsOnAnEmptyStore() {
        seeder.run(null);

        FacultyAdmin admin = facultyAdminRepository.findById("ADM-001").orElseThrow();
        assertThat(admin.getEmail()).isEqualTo("admin@acme.inc");
        assertThat(passwordEncoder.matches("password", admin.getPassword())).isTrue();
    }

    @Test
    @DisplayName("DEFAULT_ADMIN_PASSWORD replaces the fallback password")
    void seedsWithTheConfiguredPassword() {
        environment.setProperty("DEFAULT_ADMIN_PASSWORD", "configured-pw");

        seeder.run(null);

        String digest = facultyAdminRepository.findById("ADM-001").orElseThrow().getPassword();
        assertThat(passwordEncoder.matches("configured-pw", digest)).isTrue();
    }

    @Test
    @DisplayName("the admin@acme.com account is renamed in place, keeping its password and team")
    void renamesTheLegacyAdmin() {
        FacultyAdmin legacy = new FacultyAdmin(
            "admin@acme.com", passwordEncoder.encode("changed-pw"), "ADM-001");
        Engineer engineer = new Engineer("e1@acme.com", "hash", "E1");
        legacy.addEngineer(engineer);
        facultyAdminRepository.save(legacy);
        engineerRepository.save(engineer);
        String digest = legacy.getPassword();

        seeder.run(null);

        assertThat(facultyAdminRepository.findAll()).hasSize(1);
        FacultyAdmin admin = facultyAdminRepository.findById("ADM-001").orElseThrow();
        assertThat(admin.getEmail()).isEqualTo("admin@acme.inc");
        assertThat(admin.getPassword()).isEqualTo(digest);
        assertThat(admin.managesEngineer(engineer)).isTrue();
        assertThat(directory.findByEmail("admin@acme.com")).isEmpty();
        assertThat(directory.findByEmail("admin@acme.inc")).isPresent();
    }

    @Test
    @DisplayName("running again, as every cold start does, changes nothing")
    void runningTwiceChangesNothing() {
        seeder.run(null);
        String digest = facultyAdminRepository.findById("ADM-001").orElseThrow().getPassword();

        seeder.run(null);

        assertThat(facultyAdminRepository.findAll()).hasSize(1);
        assertThat(facultyAdminRepository.findById("ADM-001").orElseThrow().getPassword())
            .isEqualTo(digest);
    }

    @Test
    @DisplayName("an ADM-001 that is not the old seeded admin is neither renamed nor replaced")
    void leavesAnUnrelatedAdm001Alone() {
        engineerRepository.save(new Engineer("admin@acme.com", "hash", "ADM-001"));

        seeder.run(null);

        assertThat(facultyAdminRepository.findAll()).isEmpty();
        assertThat(engineerRepository.findById("ADM-001").orElseThrow().getEmail())
            .isEqualTo("admin@acme.com");
    }

    @Test
    @DisplayName("once admin@acme.inc exists, an old admin@acme.com account is left as it is")
    void leavesTheLegacyAdminWhenTheNewOneExists() {
        facultyAdminRepository.save(new FacultyAdmin("admin@acme.inc", "hash", "FA-9"));
        facultyAdminRepository.save(new FacultyAdmin("admin@acme.com", "hash", "ADM-001"));

        seeder.run(null);

        assertThat(facultyAdminRepository.findById("ADM-001").orElseThrow().getEmail())
            .isEqualTo("admin@acme.com");
        assertThat(facultyAdminRepository.findAll()).hasSize(2);
    }
}
