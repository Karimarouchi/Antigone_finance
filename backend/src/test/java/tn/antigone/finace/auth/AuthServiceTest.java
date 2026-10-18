package tn.antigone.finace.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock AppUserRepository userRepo;
    @Mock ProfileRepository profileRepo;
    @Mock RefreshTokenRepository rtRepo;
    @Mock InviteCodeRepository inviteRepo;
    @Mock FeatureService featureService;
    @Mock PasswordEncoder encoder;
    @Mock JwtService jwt;

    @InjectMocks AuthService service;

    private final UUID userId = UUID.randomUUID();
    private final UUID inviterId = UUID.randomUUID();

    private AppUser user(String passwordHash) {
        return AppUser.builder().id(userId).email("jane@example.test")
                .passwordHash(passwordHash).provider("local").build();
    }

    private Profile profile(boolean disabled) {
        return Profile.builder().id(userId).email("jane@example.test")
                .fullName("Jane Doe").role("user").disabled(disabled).build();
    }

    private void stubTokenIssuing() {
        when(jwt.issueAccessToken(any(), anyString(), anyString())).thenReturn("access-token");
        when(jwt.getRefreshTtlDays()).thenReturn(30L);
        when(jwt.getAccessTtlMinutes()).thenReturn(240L);
    }

    // ── signup ──────────────────────────────────────────────────────────────

    private AuthDtos.SignupReq signupReq() {
        return new AuthDtos.SignupReq("Jane", "Doe", "  Jane@Example.TEST ", "secret123", " INVITE42 ");
    }

    private InviteCode validInvite() {
        return InviteCode.builder().code("INVITE42").createdBy(inviterId)
                .features(new String[] { "clients", "invoice" }).build();
    }

    @Test
    void signupCreatesUserProfileGrantsInviteFeaturesAndConsumesInvite() {
        InviteCode invite = validInvite();
        when(userRepo.existsByEmailIgnoreCase("  Jane@Example.TEST ")).thenReturn(false);
        when(inviteRepo.findByCodeIgnoreCase("INVITE42")).thenReturn(Optional.of(invite));
        when(encoder.encode("secret123")).thenReturn("hashed");
        when(userRepo.save(any(AppUser.class))).thenAnswer(inv -> {
            AppUser u = inv.getArgument(0);
            u.setId(userId);
            return u;
        });
        when(profileRepo.save(any(Profile.class))).thenAnswer(inv -> inv.getArgument(0));
        stubTokenIssuing();

        AuthDtos.TokenPair pair = service.signup(signupReq());

        ArgumentCaptor<AppUser> savedUser = ArgumentCaptor.forClass(AppUser.class);
        verify(userRepo).save(savedUser.capture());
        assertThat(savedUser.getValue().getEmail()).isEqualTo("jane@example.test");
        assertThat(savedUser.getValue().getPasswordHash()).isEqualTo("hashed");
        assertThat(savedUser.getValue().getProvider()).isEqualTo("local");
        assertThat(savedUser.getValue().isEmailVerified()).isFalse();

        ArgumentCaptor<Profile> savedProfile = ArgumentCaptor.forClass(Profile.class);
        verify(profileRepo).save(savedProfile.capture());
        assertThat(savedProfile.getValue().getId()).isEqualTo(userId);
        assertThat(savedProfile.getValue().getFullName()).isEqualTo("Jane Doe");
        assertThat(savedProfile.getValue().getRole()).isEqualTo("user");

        verify(featureService).grant(userId, "clients", inviterId);
        verify(featureService).grant(userId, "invoice", inviterId);
        assertThat(invite.getUsedAt()).isNotNull();
        assertThat(invite.getUsedBy()).isEqualTo(userId);

        assertThat(pair.accessToken()).isEqualTo("access-token");
        assertThat(pair.refreshToken()).isNotBlank();
        assertThat(pair.accessTtlMinutes()).isEqualTo(240L);
        assertThat(pair.user().id()).isEqualTo(userId);
        assertThat(pair.user().email()).isEqualTo("jane@example.test");
        assertThat(pair.user().role()).isEqualTo("user");
    }

    @Test
    void signupStoresOnlyTheHashOfTheIssuedRefreshToken() {
        when(userRepo.existsByEmailIgnoreCase(anyString())).thenReturn(false);
        when(inviteRepo.findByCodeIgnoreCase("INVITE42")).thenReturn(Optional.of(validInvite()));
        when(encoder.encode(anyString())).thenReturn("hashed");
        when(userRepo.save(any(AppUser.class))).thenAnswer(inv -> {
            AppUser u = inv.getArgument(0);
            u.setId(userId);
            return u;
        });
        when(profileRepo.save(any(Profile.class))).thenAnswer(inv -> inv.getArgument(0));
        stubTokenIssuing();

        Instant before = Instant.now();
        AuthDtos.TokenPair pair = service.signup(signupReq());

        ArgumentCaptor<RefreshToken> rt = ArgumentCaptor.forClass(RefreshToken.class);
        verify(rtRepo).save(rt.capture());
        assertThat(rt.getValue().getUserId()).isEqualTo(userId);
        assertThat(rt.getValue().getTokenHash())
                .isEqualTo(AuthService.sha256(pair.refreshToken()))
                .isNotEqualTo(pair.refreshToken());
        assertThat(rt.getValue().getExpiresAt())
                .isAfterOrEqualTo(before.plus(30, ChronoUnit.DAYS))
                .isBefore(Instant.now().plus(30, ChronoUnit.DAYS).plusSeconds(5));
    }

    @Test
    void signupRejectsAlreadyUsedEmail() {
        when(userRepo.existsByEmailIgnoreCase(anyString())).thenReturn(true);

        assertThatThrownBy(() -> service.signup(signupReq()))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Cet email est déjà utilisé.");
        verify(userRepo, never()).save(any());
    }

    @Test
    void signupRejectsUnknownInviteCode() {
        when(userRepo.existsByEmailIgnoreCase(anyString())).thenReturn(false);
        when(inviteRepo.findByCodeIgnoreCase("INVITE42")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.signup(signupReq()))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Code d'invitation invalide.");
        verify(userRepo, never()).save(any());
    }

    @Test
    void signupRejectsAlreadyUsedInvite() {
        InviteCode invite = validInvite();
        invite.setUsedAt(Instant.now().minusSeconds(60));
        when(userRepo.existsByEmailIgnoreCase(anyString())).thenReturn(false);
        when(inviteRepo.findByCodeIgnoreCase("INVITE42")).thenReturn(Optional.of(invite));

        assertThatThrownBy(() -> service.signup(signupReq()))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Code d'invitation déjà utilisé.");
        verify(userRepo, never()).save(any());
    }

    @Test
    void signupRejectsExpiredInvite() {
        InviteCode invite = validInvite();
        invite.setExpiresAt(Instant.now().minusSeconds(1));
        when(userRepo.existsByEmailIgnoreCase(anyString())).thenReturn(false);
        when(inviteRepo.findByCodeIgnoreCase("INVITE42")).thenReturn(Optional.of(invite));

        assertThatThrownBy(() -> service.signup(signupReq()))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Ce code d'invitation a expiré.");
        verify(userRepo, never()).save(any());
    }

    // ── login ───────────────────────────────────────────────────────────────

    @Test
    void loginReturnsTokenPairForValidCredentials() {
        when(userRepo.findByEmailIgnoreCase("jane@example.test")).thenReturn(Optional.of(user("hashed")));
        when(encoder.matches("secret123", "hashed")).thenReturn(true);
        when(profileRepo.findById(userId)).thenReturn(Optional.of(profile(false)));
        stubTokenIssuing();

        AuthDtos.TokenPair pair = service.login(new AuthDtos.LoginReq("jane@example.test", "secret123"));

        assertThat(pair.accessToken()).isEqualTo("access-token");
        assertThat(pair.user().fullName()).isEqualTo("Jane Doe");
        verify(jwt).issueAccessToken(userId, "jane@example.test", "user");
        verify(rtRepo).save(any(RefreshToken.class));
    }

    @Test
    void loginRejectsUnknownEmail() {
        when(userRepo.findByEmailIgnoreCase("nobody@example.test")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.login(new AuthDtos.LoginReq("nobody@example.test", "x")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Email ou mot de passe incorrect.");
    }

    @Test
    void loginRejectsWrongPassword() {
        when(userRepo.findByEmailIgnoreCase("jane@example.test")).thenReturn(Optional.of(user("hashed")));
        when(encoder.matches("wrong", "hashed")).thenReturn(false);

        assertThatThrownBy(() -> service.login(new AuthDtos.LoginReq("jane@example.test", "wrong")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Email ou mot de passe incorrect.");
        verifyNoInteractions(jwt, rtRepo);
    }

    @Test
    void loginRejectsAccountWithoutPasswordSuchAsGoogleAccounts() {
        when(userRepo.findByEmailIgnoreCase("jane@example.test")).thenReturn(Optional.of(user(null)));

        assertThatThrownBy(() -> service.login(new AuthDtos.LoginReq("jane@example.test", "anything")))
                .isInstanceOf(UnauthorizedException.class);
        verify(encoder, never()).matches(any(), any());
    }

    @Test
    void loginRejectsBannedUser() {
        AppUser banned = user("hashed");
        banned.setBannedUntil(Instant.now().plusSeconds(3600));
        when(userRepo.findByEmailIgnoreCase("jane@example.test")).thenReturn(Optional.of(banned));
        when(encoder.matches("secret123", "hashed")).thenReturn(true);

        assertThatThrownBy(() -> service.login(new AuthDtos.LoginReq("jane@example.test", "secret123")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Compte désactivé.");
        verifyNoInteractions(jwt);
    }

    @Test
    void loginAllowsUserWhoseBanHasExpired() {
        AppUser formerlyBanned = user("hashed");
        formerlyBanned.setBannedUntil(Instant.now().minusSeconds(3600));
        when(userRepo.findByEmailIgnoreCase("jane@example.test")).thenReturn(Optional.of(formerlyBanned));
        when(encoder.matches("secret123", "hashed")).thenReturn(true);
        when(profileRepo.findById(userId)).thenReturn(Optional.of(profile(false)));
        stubTokenIssuing();

        assertThat(service.login(new AuthDtos.LoginReq("jane@example.test", "secret123")).accessToken())
                .isEqualTo("access-token");
    }

    @Test
    void loginRejectsDisabledProfile() {
        when(userRepo.findByEmailIgnoreCase("jane@example.test")).thenReturn(Optional.of(user("hashed")));
        when(encoder.matches("secret123", "hashed")).thenReturn(true);
        when(profileRepo.findById(userId)).thenReturn(Optional.of(profile(true)));

        assertThatThrownBy(() -> service.login(new AuthDtos.LoginReq("jane@example.test", "secret123")))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Compte désactivé.");
        verifyNoInteractions(jwt);
    }

    // ── refresh / logout ────────────────────────────────────────────────────

    @Test
    void refreshRotatesTokenAndIssuesNewPair() {
        RefreshToken stored = RefreshToken.builder().userId(userId)
                .tokenHash(AuthService.sha256("old-refresh"))
                .expiresAt(Instant.now().plusSeconds(3600)).build();
        when(rtRepo.findByTokenHash(AuthService.sha256("old-refresh"))).thenReturn(Optional.of(stored));
        when(userRepo.findById(userId)).thenReturn(Optional.of(user("hashed")));
        when(profileRepo.findById(userId)).thenReturn(Optional.of(profile(false)));
        stubTokenIssuing();

        AuthDtos.TokenPair pair = service.refresh("old-refresh");

        assertThat(stored.getRevokedAt()).isNotNull();
        assertThat(pair.refreshToken()).isNotEqualTo("old-refresh");
        assertThat(pair.accessToken()).isEqualTo("access-token");
    }

    @Test
    void refreshRejectsUnknownToken() {
        when(rtRepo.findByTokenHash(anyString())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.refresh("unknown"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token invalide.");
    }

    @Test
    void refreshRejectsRevokedToken() {
        RefreshToken revoked = RefreshToken.builder().userId(userId)
                .expiresAt(Instant.now().plusSeconds(3600))
                .revokedAt(Instant.now().minusSeconds(10)).build();
        when(rtRepo.findByTokenHash(anyString())).thenReturn(Optional.of(revoked));

        assertThatThrownBy(() -> service.refresh("revoked"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token expiré.");
        verifyNoInteractions(jwt);
    }

    @Test
    void refreshRejectsExpiredToken() {
        RefreshToken expired = RefreshToken.builder().userId(userId)
                .expiresAt(Instant.now().minusSeconds(1)).build();
        when(rtRepo.findByTokenHash(anyString())).thenReturn(Optional.of(expired));

        assertThatThrownBy(() -> service.refresh("expired"))
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Refresh token expiré.");
    }

    @Test
    void logoutRevokesMatchingRefreshToken() {
        RefreshToken stored = RefreshToken.builder().userId(userId)
                .expiresAt(Instant.now().plusSeconds(3600)).build();
        when(rtRepo.findByTokenHash(AuthService.sha256("my-refresh"))).thenReturn(Optional.of(stored));

        service.logout("my-refresh");

        assertThat(stored.getRevokedAt()).isNotNull();
    }

    @Test
    void logoutWithoutTokenDoesNothing() {
        service.logout(null);

        verifyNoInteractions(rtRepo);
    }

    @Test
    void sha256ReturnsUrlSafeBase64DigestWithoutPadding() {
        assertThat(AuthService.sha256("abc")).isEqualTo("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
        assertThat(AuthService.sha256("abc")).isEqualTo(AuthService.sha256("abc"));
        assertThat(AuthService.sha256("abd")).isNotEqualTo(AuthService.sha256("abc"));
    }
}
