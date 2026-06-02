package tn.antigone.finace.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.common.UnauthorizedException;
import tn.antigone.finace.feature.FeatureService;
import tn.antigone.finace.invite.InviteCode;
import tn.antigone.finace.invite.InviteCodeRepository;
import tn.antigone.finace.security.JwtService;
import tn.antigone.finace.user.AppUser;
import tn.antigone.finace.user.AppUserRepository;
import tn.antigone.finace.user.Profile;
import tn.antigone.finace.user.ProfileRepository;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final AppUserRepository userRepo;
    private final ProfileRepository profileRepo;
    private final RefreshTokenRepository rtRepo;
    private final InviteCodeRepository inviteRepo;
    private final FeatureService featureService;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    private static final SecureRandom RNG = new SecureRandom();

    // ── Signup ───────────────────────────────────────────────────────────────
    @Transactional
    public AuthDtos.TokenPair signup(AuthDtos.SignupReq r) {
        if (userRepo.existsByEmailIgnoreCase(r.email())) {
            throw new BadRequestException("Cet email est déjà utilisé.");
        }
        InviteCode invite = inviteRepo.findByCodeIgnoreCase(r.inviteCode().trim())
                .orElseThrow(() -> new BadRequestException("Code d'invitation invalide."));
        if (invite.getUsedAt() != null) throw new BadRequestException("Code d'invitation déjà utilisé.");
        if (invite.getExpiresAt() != null && invite.getExpiresAt().isBefore(Instant.now()))
            throw new BadRequestException("Ce code d'invitation a expiré.");

        AppUser user = userRepo.save(AppUser.builder()
                .email(r.email().trim().toLowerCase())
                .passwordHash(encoder.encode(r.password()))
                .emailVerified(false)
                .provider("local")
                .build());

        Profile profile = profileRepo.save(Profile.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName((r.firstName() + " " + r.lastName()).trim())
                .role("user")
                .disabled(false)
                .build());

        for (String f : invite.getFeatures()) {
            featureService.grant(user.getId(), f, invite.getCreatedBy());
        }

        invite.setUsedAt(Instant.now());
        invite.setUsedBy(user.getId());

        return issuePair(user, profile);
    }

    // ── Login ────────────────────────────────────────────────────────────────
    @Transactional
    public AuthDtos.TokenPair login(AuthDtos.LoginReq r) {
        AppUser user = userRepo.findByEmailIgnoreCase(r.email())
                .orElseThrow(() -> new UnauthorizedException("Email ou mot de passe incorrect."));
        if (user.getPasswordHash() == null
                || !encoder.matches(r.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Email ou mot de passe incorrect.");
        }
        if (user.getBannedUntil() != null && user.getBannedUntil().isAfter(Instant.now())) {
            throw new UnauthorizedException("Compte désactivé.");
        }
        Profile profile = profileRepo.findById(user.getId()).orElseThrow();
        if (profile.isDisabled()) throw new UnauthorizedException("Compte désactivé.");
        return issuePair(user, profile);
    }

    // ── Refresh ──────────────────────────────────────────────────────────────
    @Transactional
    public AuthDtos.TokenPair refresh(String refreshToken) {
        String hash = sha256(refreshToken);
        RefreshToken rt = rtRepo.findByTokenHash(hash)
                .orElseThrow(() -> new UnauthorizedException("Refresh token invalide."));
        if (rt.getRevokedAt() != null || rt.getExpiresAt().isBefore(Instant.now())) {
            throw new UnauthorizedException("Refresh token expiré.");
        }
        rt.setRevokedAt(Instant.now()); // rotation
        AppUser user = userRepo.findById(rt.getUserId()).orElseThrow();
        Profile profile = profileRepo.findById(user.getId()).orElseThrow();
        return issuePair(user, profile);
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null) return;
        rtRepo.findByTokenHash(sha256(refreshToken))
                .ifPresent(rt -> rt.setRevokedAt(Instant.now()));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private AuthDtos.TokenPair issuePair(AppUser u, Profile p) {
        String access = jwt.issueAccessToken(u.getId(), u.getEmail(), p.getRole());
        String refresh = generateOpaque();
        rtRepo.save(RefreshToken.builder()
                .userId(u.getId())
                .tokenHash(sha256(refresh))
                .expiresAt(Instant.now().plus(jwt.getRefreshTtlDays(), ChronoUnit.DAYS))
                .createdAt(Instant.now())
                .build());
        return new AuthDtos.TokenPair(
                access, refresh, jwt.getAccessTtlMinutes(),
                new AuthDtos.UserDto(u.getId(), u.getEmail(),
                        p.getFullName(), p.getAvatarUrl(), p.getRole()));
    }

    private static String generateOpaque() {
        byte[] b = new byte[48];
        RNG.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    public static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] h = md.digest(input.getBytes());
            return Base64.getUrlEncoder().withoutPadding().encodeToString(h);
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}
