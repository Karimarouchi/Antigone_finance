package tn.antigone.finace.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import tn.antigone.finace.common.UnauthorizedException;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SecurityUtilsTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static void authenticate(Object principal) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
    }

    @Test
    void currentPrincipalIsEmptyWithoutAuthentication() {
        assertThat(SecurityUtils.currentPrincipal()).isEmpty();
    }

    @Test
    void currentPrincipalIsEmptyWhenPrincipalIsNotAUserPrincipal() {
        authenticate("anonymousUser");

        assertThat(SecurityUtils.currentPrincipal()).isEmpty();
    }

    @Test
    void currentPrincipalReturnsAuthenticatedUserPrincipal() {
        UserPrincipal p = new UserPrincipal(UUID.randomUUID(), "jane@example.test", "admin");
        authenticate(p);

        assertThat(SecurityUtils.currentPrincipal()).containsSame(p);
        assertThat(SecurityUtils.requirePrincipal()).isSameAs(p);
    }

    @Test
    void currentUserIdReturnsPrincipalId() {
        UUID id = UUID.randomUUID();
        authenticate(new UserPrincipal(id, "jane@example.test", "user"));

        assertThat(SecurityUtils.currentUserId()).isEqualTo(id);
    }

    @Test
    void requirePrincipalThrowsUnauthorizedWhenAnonymous() {
        assertThatThrownBy(SecurityUtils::requirePrincipal)
                .isInstanceOf(UnauthorizedException.class)
                .hasMessage("Authentication required");
        assertThatThrownBy(SecurityUtils::currentUserId).isInstanceOf(UnauthorizedException.class);
    }

    @Test
    void userPrincipalDefaultsRoleToUserAndExposesSpringAuthority() {
        UserPrincipal p = new UserPrincipal(UUID.randomUUID(), "jane@example.test", null);

        assertThat(p.getRole()).isEqualTo("user");
        assertThat(p.getAuthorities()).extracting(Object::toString).containsExactly("ROLE_USER");
        assertThat(new UserPrincipal(UUID.randomUUID(), "a@example.test", "super_admin").getAuthorities())
                .extracting(Object::toString).containsExactly("ROLE_SUPER_ADMIN");
    }
}
