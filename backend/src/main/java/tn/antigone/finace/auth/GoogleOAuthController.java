package tn.antigone.finace.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.UnauthorizedException;
import tn.antigone.finace.feature.FeatureService;
import tn.antigone.finace.security.JwtService;
import tn.antigone.finace.user.AppUser;
import tn.antigone.finace.user.AppUserRepository;
import tn.antigone.finace.user.Profile;
import tn.antigone.finace.user.ProfileRepository;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

@Slf4j
@Service
@RequiredArgsConstructor
class GoogleOAuthService {

    private final AppUserRepository userRepo;
    private final ProfileRepository profileRepo;
    private final RefreshTokenRepository rtRepo;
    private final FeatureService featureService;
    private final JwtService jwt;
    private final ObjectMapper objectMapper;

    @Value("${app.oauth.google.client-id:}")
    private String expectedClientId;

    private static final SecureRandom RNG = new SecureRandom();
    private static final HttpClient HTTP = HttpClient.newHttpClient();

    /** Validates the id_token via Google's tokeninfo endpoint and returns the parsed claims. */
    JsonNode verifyIdToken(String idToken) {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=" + idToken))
                    .GET().build();
            HttpResponse<String> res = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() != 200)
                throw new UnauthorizedException("Token Google invalide.");
            JsonNode claims = objectMapper.readTree(res.body());
            if (expectedClientId != null && !expectedClientId.isBlank()) {
                String aud = claims.path("aud").asText("");
                if (!expectedClientId.equals(aud))
                    throw new UnauthorizedException("Audience Google invalide.");
            }
            if (!"true".equalsIgnoreCase(claims.path("email_verified").asText("false")))
                throw new UnauthorizedException("Email Google non vérifié.");
            return claims;
        } catch (UnauthorizedException e) {
            throw e;
        } catch (Exception e) {
            log.error("Google id_token verification failed", e);
            throw new UnauthorizedException("Vérification Google échouée.");
        }
    }

    @Transactional
    AuthDtos.TokenPair loginOrCreate(String idToken) {
        JsonNode c = verifyIdToken(idToken);
        String email = c.path("email").asText().toLowerCase();
        String sub   = c.path("sub").asText();
        String name  = c.path("name").asText("");
        String pic   = c.path("picture").asText(null);

        AppUser user = userRepo.findByProviderAndProviderId("google", sub)
                .or(() -> userRepo.findByEmailIgnoreCase(email))
                .orElseGet(() -> userRepo.save(AppUser.builder()
                        .email(email).emailVerified(true)
                        .provider("google").providerId(sub).build()));

        if (!"google".equals(user.getProvider())) {
            user.setProvider("google");
            user.setProviderId(sub);
        }

        Profile profile = profileRepo.findById(user.getId()).orElseGet(() ->
                profileRepo.save(Profile.builder()
                        .id(user.getId()).email(email).fullName(name).avatarUrl(pic)
                        .role("user").disabled(false).build()));
        if (profile.getAvatarUrl() == null && pic != null) profile.setAvatarUrl(pic);
        if ((profile.getFullName() == null || profile.getFullName().isBlank()) && !name.isBlank())
            profile.setFullName(name);

        String access = jwt.issueAccessToken(user.getId(), user.getEmail(), profile.getRole());
        String refresh = randomOpaque();
        rtRepo.save(RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(sha256(refresh))
                .expiresAt(Instant.now().plus(jwt.getRefreshTtlDays(), ChronoUnit.DAYS))
                .createdAt(Instant.now())
                .build());
        return new AuthDtos.TokenPair(access, refresh, jwt.getAccessTtlMinutes(),
                new AuthDtos.UserDto(user.getId(), user.getEmail(),
                        profile.getFullName(), profile.getAvatarUrl(), profile.getRole()));
    }

    private static String randomOpaque() {
        byte[] b = new byte[48]; RNG.nextBytes(b);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }
    private static String sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return Base64.getUrlEncoder().withoutPadding().encodeToString(md.digest(s.getBytes()));
        } catch (Exception e) { throw new RuntimeException(e); }
    }
}

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
class GoogleOAuthController {

    private final GoogleOAuthService service;

    @PostMapping("/google")
    public AuthDtos.TokenPair google(@RequestBody AuthDtos.GoogleReq r) {
        return service.loginOrCreate(r.idToken());
    }
}
