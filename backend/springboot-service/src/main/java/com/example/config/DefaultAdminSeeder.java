package com.example.config;

import com.example.auth.CompanyAccounts;
import com.example.auth.EmployeeDirectory;
import com.example.classes.FacultyAdmin;
import com.example.repos.FacultyAdminRepository;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Makes sure every deployment has the default admin to sign in as: admin@acme.inc.
 *
 * A fresh database has nobody in it, and the only way in is the anonymous bootstrap call to
 * POST /faculty-admins. That is friction for no benefit here, so this creates the same account
 * the frontend's mock mode offers (ADM-001, admin@acme.inc, password "password" unless
 * DEFAULT_ADMIN_PASSWORD says otherwise). It is the only account that may make faculty admins;
 * see {@link CompanyAccounts}.
 *
 * Databases seeded before the move to acme.inc hold ADM-001 as admin@acme.com. That account is
 * renamed in place rather than a second one seeded, so it keeps its password, its reports and its
 * team, and admin@acme.com stops being a login.
 *
 * Runs locally and in the cloud alike. The login is a well-known one, so on the deployed site
 * anyone who knows it can sign in as an admin; Terraform does not pass DEFAULT_ADMIN_PASSWORD, so
 * the cloud password is always "password".
 *
 * Idempotent: it does nothing when any account already has that email, so a changed password or a
 * deliberately different account under that address is left alone, and a Lambda cold start can run
 * it again safely. Runs after schema.sql, which Spring applies while the DataSource starts, before
 * any runner.
 */
@Component
@Profile("!test")
public class DefaultAdminSeeder implements ApplicationRunner {

    private static final Logger LOG = LoggerFactory.getLogger(DefaultAdminSeeder.class);

    /** The seeded account's email, matching the mock fixtures. */
    static final String EMAIL = CompanyAccounts.DEFAULT_ADMIN_EMAIL;

    /** The seeded account's employee id, matching the mock fixtures. */
    static final String EMPLOYEE_ID = "ADM-001";

    /** The password used when DEFAULT_ADMIN_PASSWORD is not set, matching the mock's demo password. */
    private static final String FALLBACK_PASSWORD = "password";

    private final Environment environment;

    private final EmployeeDirectory directory;

    private final FacultyAdminRepository facultyAdminRepository;

    private final PasswordEncoder passwordEncoder;

    public DefaultAdminSeeder(
        Environment environment,
        EmployeeDirectory directory,
        FacultyAdminRepository facultyAdminRepository,
        PasswordEncoder passwordEncoder
    ) {
        this.environment = environment;
        this.directory = directory;
        this.facultyAdminRepository = facultyAdminRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (directory.findByEmail(EMAIL).isPresent()) {
            return;
        }
        if (renameLegacyAdmin()) {
            return;
        }
        if (directory.existsById(EMPLOYEE_ID)) {
            LOG.warn("Not seeding {}: employee id {} is already taken", EMAIL, EMPLOYEE_ID);
            return;
        }
        String password = environment.getProperty("DEFAULT_ADMIN_PASSWORD", FALLBACK_PASSWORD);
        facultyAdminRepository.save(
            new FacultyAdmin(EMAIL, passwordEncoder.encode(password), EMPLOYEE_ID));
        LOG.info("Seeded faculty admin {} ({})", EMAIL, EMPLOYEE_ID);
    }

    /**
     * Moves the admin seeded before the move to acme.inc over to the new address.
     *
     * Only the exact account this class used to seed qualifies: ADM-001, a faculty admin, under
     * {@value CompanyAccounts#LEGACY_ADMIN_EMAIL}. The password digest is left as it is, so whatever
     * password it had still signs in, and open sessions stay valid because they are tied to the
     * digest rather than the address.
     *
     * @return true when the account was renamed, false when there was nothing to rename
     */
    private boolean renameLegacyAdmin() {
        Optional<FacultyAdmin> legacy = facultyAdminRepository.findById(EMPLOYEE_ID)
            .filter(admin -> CompanyAccounts.LEGACY_ADMIN_EMAIL.equalsIgnoreCase(admin.getEmail()));
        if (legacy.isEmpty()) {
            return false;
        }
        FacultyAdmin admin = legacy.get();
        admin.setEmail(EMAIL);
        facultyAdminRepository.save(admin);
        LOG.info("Renamed faculty admin {} from {} to {}",
            EMPLOYEE_ID, CompanyAccounts.LEGACY_ADMIN_EMAIL, EMAIL);
        return true;
    }
}
