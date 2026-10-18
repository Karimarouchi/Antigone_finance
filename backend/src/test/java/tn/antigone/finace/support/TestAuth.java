package tn.antigone.finace.support;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tn.antigone.finace.security.UserPrincipal;

import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

/**
 * Authenticates a MockMvc request with the same {@link UserPrincipal} the JWT filter
 * would put in the security context, so {@code SecurityUtils} and {@code @PreAuthorize} work.
 */
public final class TestAuth {

    private TestAuth() {}

    public static RequestPostProcessor as(UUID userId, String role) {
        UserPrincipal principal = new UserPrincipal(userId, "user@example.test", role);
        return authentication(new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities()));
    }
}
