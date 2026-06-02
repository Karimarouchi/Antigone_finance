package tn.antigone.finace.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import tn.antigone.finace.feature.FeatureService;
import tn.antigone.finace.user.AppUser;
import tn.antigone.finace.user.AppUserRepository;
import tn.antigone.finace.user.Profile;
import tn.antigone.finace.user.ProfileRepository;

import java.util.List;

/**
 * Bootstraps a built-in super-admin account on the very first startup.
 *
 * Credentials:
 *   email    : Admin@Antigoneagency.com
 *   password : Admin@123
 *
 * Idempotent: if the account already exists the runner is a no-op
 * (but it WILL upgrade an existing account to role=super_admin if needed).
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class AdminBootstrap {

    private static final String ADMIN_EMAIL    = "Admin@Antigoneagency.com";
    private static final String ADMIN_PASSWORD = "Admin@123";
    private static final String ADMIN_NAME     = "Antigone Administrator";

    /** Every feature ID currently defined in the app (mirrors `config/features.ts`). */
    private static final List<String> ALL_FEATURES = List.of(
        "home", "clients", "apercu", "contacts", "projects",
        "invoice-creator", "admin", "super-admin",
        "encaissements", "encaissements-overview",
        "encaissements-factures", "encaissements-autres-revenus",
        "decaissements", "decaissements-overview", "decaissements-salaires",
        "decaissements-charges-fixes", "decaissements-charges-variables",
        "decaissements-etat", "decaissements-dettes"
    );

    @Bean
    public ApplicationRunner finaceAdminBootstrap(AppUserRepository users,
                                                  ProfileRepository profiles,
                                                  FeatureService features,
                                                  PasswordEncoder encoder) {
        return args -> {
            String normalized = ADMIN_EMAIL.trim().toLowerCase();

            AppUser user = users.findByEmailIgnoreCase(normalized).orElse(null);
            if (user == null) {
                user = users.save(AppUser.builder()
                        .email(normalized)
                        .passwordHash(encoder.encode(ADMIN_PASSWORD))
                        .emailVerified(true)
                        .provider("local")
                        .build());
                log.info("[bootstrap] Created super-admin account <{}>", ADMIN_EMAIL);
            } else {
                // Keep password in sync with the documented credentials.
                if (user.getPasswordHash() == null
                        || !encoder.matches(ADMIN_PASSWORD, user.getPasswordHash())) {
                    user.setPasswordHash(encoder.encode(ADMIN_PASSWORD));
                    users.save(user);
                    log.info("[bootstrap] Reset super-admin password for <{}>", ADMIN_EMAIL);
                }
            }

            Profile profile = profiles.findById(user.getId()).orElse(null);
            if (profile == null) {
                profile = profiles.save(Profile.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .fullName(ADMIN_NAME)
                        .role("super_admin")
                        .disabled(false)
                        .build());
                log.info("[bootstrap] Created profile for super-admin");
            } else if (!"super_admin".equals(profile.getRole())) {
                profile.setRole("super_admin");
                profile.setDisabled(false);
                profiles.save(profile);
                log.info("[bootstrap] Upgraded <{}> to super_admin", ADMIN_EMAIL);
            }

            // Grant every feature flag to the super-admin (idempotent).
            for (String f : ALL_FEATURES) {
                try { features.grant(user.getId(), f, user.getId()); }
                catch (Exception ignored) { /* already granted */ }
            }
        };
    }
}
