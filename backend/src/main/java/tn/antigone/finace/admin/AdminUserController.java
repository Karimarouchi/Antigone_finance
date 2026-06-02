package tn.antigone.finace.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.FeatureService;
import tn.antigone.finace.user.AppUser;
import tn.antigone.finace.user.AppUserRepository;
import tn.antigone.finace.user.Profile;
import tn.antigone.finace.user.ProfileRepository;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
@RequiredArgsConstructor
public class AdminUserController {

    private static final Set<String> ROLES = Set.of("user", "admin", "super_admin");

    private final AppUserRepository userRepo;
    private final ProfileRepository profileRepo;
    private final FeatureService featureService;
    private final PasswordEncoder passwordEncoder;

    public record UserView(
            UUID id, String email, String fullName, String avatarUrl,
            String role, boolean disabled, Instant bannedUntil,
            String provider, Instant createdAt, List<String> features) {
    }

    @GetMapping
    public List<UserView> list() {
        return userRepo.findAll().stream().map(u -> {
            Profile p = profileRepo.findById(u.getId()).orElse(null);
            return new UserView(
                    u.getId(), u.getEmail(),
                    p == null ? null : p.getFullName(),
                    p == null ? null : p.getAvatarUrl(),
                    p == null ? "user" : p.getRole(),
                    p != null && p.isDisabled(),
                    u.getBannedUntil(),
                    u.getProvider(),
                    u.getCreatedAt(),
                    featureService.listFeatures(u.getId()));
        }).toList();
    }

    public record RoleReq(String role) {
    }

    @PatchMapping("/{id}/role")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    public Profile setRole(@PathVariable UUID id, @RequestBody RoleReq r) {
        if (!ROLES.contains(r.role()))
            throw new BadRequestException("Rôle invalide");
        Profile p = profileRepo.findById(id).orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        p.setRole(r.role());
        return p;
    }

    public record BanReq(Instant until) {
    }

    @PostMapping("/{id}/ban")
    @Transactional
    public AppUser ban(@PathVariable UUID id, @RequestBody BanReq r) {
        AppUser u = userRepo.findById(id).orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        u.setBannedUntil(r.until() == null ? Instant.now().plusSeconds(365L * 86400) : r.until());
        return u;
    }

    @PostMapping("/{id}/unban")
    @Transactional
    public AppUser unban(@PathVariable UUID id) {
        AppUser u = userRepo.findById(id).orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        u.setBannedUntil(null);
        return u;
    }

    public record DisabledReq(boolean disabled) {
    }

    @PatchMapping("/{id}/disabled")
    @Transactional
    public Profile setDisabled(@PathVariable UUID id, @RequestBody DisabledReq r) {
        Profile p = profileRepo.findById(id).orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        p.setDisabled(r.disabled());
        return p;
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    public void delete(@PathVariable UUID id) {
        if (!userRepo.existsById(id))
            throw new NotFoundException("Utilisateur introuvable");
        userRepo.deleteById(id);
    }

    // ── Create user (super-admin, no invite required) ────────────────────────
    public record CreateUserReq(String email, String password, String fullName) {
    }

    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    public UserView create(@RequestBody CreateUserReq r) {
        if (r.email() == null || r.email().isBlank())
            throw new BadRequestException("Email requis");
        if (r.password() == null || r.password().length() < 6)
            throw new BadRequestException("Mot de passe trop court (min 6 chars)");
        if (userRepo.existsByEmailIgnoreCase(r.email()))
            throw new BadRequestException("Cet email est déjà utilisé");

        AppUser user = userRepo.save(AppUser.builder()
                .email(r.email().trim().toLowerCase())
                .passwordHash(passwordEncoder.encode(r.password()))
                .emailVerified(true)
                .provider("local")
                .build());

        Profile profile = profileRepo.save(Profile.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(r.fullName() != null ? r.fullName().trim() : null)
                .role("user")
                .disabled(false)
                .build());

        return new UserView(user.getId(), user.getEmail(),
                profile.getFullName(), profile.getAvatarUrl(),
                profile.getRole(), false, null,
                user.getProvider(), user.getCreatedAt(), List.of());
    }

    // ── Update user name/email/password (super-admin) ────────────────────────
    public record UpdateUserReq(String email, String password, String fullName) {
    }

    @PatchMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    public UserView update(@PathVariable UUID id, @RequestBody UpdateUserReq r) {
        AppUser user = userRepo.findById(id).orElseThrow(() -> new NotFoundException("Utilisateur introuvable"));
        Profile profile = profileRepo.findById(id).orElseThrow(() -> new NotFoundException("Profil introuvable"));

        if (r.email() != null && !r.email().isBlank()) {
            String newEmail = r.email().trim().toLowerCase();
            if (!newEmail.equals(user.getEmail()) && userRepo.existsByEmailIgnoreCase(newEmail))
                throw new BadRequestException("Cet email est déjà utilisé");
            user.setEmail(newEmail);
            profile.setEmail(newEmail);
        }
        if (r.password() != null && !r.password().isBlank()) {
            if (r.password().length() < 6)
                throw new BadRequestException("Mot de passe trop court (min 6 chars)");
            user.setPasswordHash(passwordEncoder.encode(r.password()));
        }
        if (r.fullName() != null) {
            profile.setFullName(r.fullName().trim());
        }

        return new UserView(user.getId(), user.getEmail(),
                profile.getFullName(), profile.getAvatarUrl(),
                profile.getRole(), profile.isDisabled(),
                user.getBannedUntil(), user.getProvider(),
                user.getCreatedAt(), featureService.listFeatures(user.getId()));
    }
}
