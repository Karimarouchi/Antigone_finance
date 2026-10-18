package tn.antigone.finace.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.SignatureException;
import org.junit.jupiter.api.Test;
import tn.antigone.finace.config.AppProperties;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String TEST_SECRET = "test-only-secret-0123456789-abcdefghijklmnopqrstuvwxyz-ABCDEFGH";

    private static AppProperties props(String secret, long accessTtlMinutes) {
        AppProperties p = new AppProperties();
        p.getJwt().setSecret(secret);
        p.getJwt().setAccessTtlMinutes(accessTtlMinutes);
        p.getJwt().setRefreshTtlDays(7);
        return p;
    }

    @Test
    void constructorRejectsSecretShorterThan32Bytes() {
        assertThatThrownBy(() -> new JwtService(props("too-short", 15)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32 bytes");
    }

    @Test
    void exposesConfiguredTtls() {
        JwtService jwt = new JwtService(props(TEST_SECRET, 45));

        assertThat(jwt.getAccessTtlMinutes()).isEqualTo(45);
        assertThat(jwt.getRefreshTtlDays()).isEqualTo(7);
    }

    @Test
    void issuedTokenCanBeParsedBackWithItsClaims() {
        JwtService jwt = new JwtService(props(TEST_SECRET, 15));
        UUID userId = UUID.randomUUID();

        String token = jwt.issueAccessToken(userId, "jane@example.test", "admin");
        Claims claims = jwt.parse(token);

        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims.get("email", String.class)).isEqualTo("jane@example.test");
        assertThat(claims.get("role", String.class)).isEqualTo("admin");
        assertThat(claims.getExpiration().getTime() - claims.getIssuedAt().getTime())
                .isEqualTo(15 * 60 * 1000L);
    }

    @Test
    void parseRejectsTokenSignedWithAnotherKey() {
        JwtService issuer = new JwtService(props(TEST_SECRET, 15));
        JwtService verifier = new JwtService(props(TEST_SECRET.replace('a', 'b'), 15));
        String token = issuer.issueAccessToken(UUID.randomUUID(), "jane@example.test", "user");

        assertThatThrownBy(() -> verifier.parse(token)).isInstanceOf(SignatureException.class);
    }

    @Test
    void parseRejectsTamperedToken() {
        JwtService jwt = new JwtService(props(TEST_SECRET, 15));
        String token = jwt.issueAccessToken(UUID.randomUUID(), "jane@example.test", "user");
        String[] parts = token.split("\\.");
        String forgedPayload = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                ("{\"sub\":\"" + UUID.randomUUID() + "\",\"role\":\"super_admin\"}").getBytes());

        assertThatThrownBy(() -> jwt.parse(parts[0] + "." + forgedPayload + "." + parts[2]))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void parseRejectsExpiredToken() {
        JwtService jwt = new JwtService(props(TEST_SECRET, -1));
        String token = jwt.issueAccessToken(UUID.randomUUID(), "jane@example.test", "user");

        assertThatThrownBy(() -> jwt.parse(token)).isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void parseRejectsGarbage() {
        JwtService jwt = new JwtService(props(TEST_SECRET, 15));

        assertThatThrownBy(() -> jwt.parse("not-a-jwt")).isInstanceOf(JwtException.class);
    }
}
