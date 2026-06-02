package tn.antigone.finace.security;

import org.springframework.security.core.context.SecurityContextHolder;
import tn.antigone.finace.common.UnauthorizedException;

import java.util.Optional;
import java.util.UUID;

public final class SecurityUtils {
    private SecurityUtils() {}

    public static Optional<UserPrincipal> currentPrincipal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal p)) {
            return Optional.empty();
        }
        return Optional.of(p);
    }

    public static UserPrincipal requirePrincipal() {
        return currentPrincipal().orElseThrow(() ->
                new UnauthorizedException("Authentication required"));
    }

    public static UUID currentUserId() {
        return requirePrincipal().getId();
    }
}
