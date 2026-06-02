package tn.antigone.finace.feature;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.security.SecurityUtils;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/me/features")
@RequiredArgsConstructor
public class UserFeatureController {

    private final FeatureService service;

    @GetMapping
    public Map<String, List<String>> mine() {
        return Map.of("features", service.listFeatures(SecurityUtils.currentUserId()));
    }

    // ── Admin grants/revokes ──────────────────────────────────────────────────
    @PostMapping("/admin/{userId}/{featureId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public void grant(@PathVariable UUID userId, @PathVariable String featureId) {
        service.grant(userId, featureId, SecurityUtils.currentUserId());
    }

    @DeleteMapping("/admin/{userId}/{featureId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public void revoke(@PathVariable UUID userId, @PathVariable String featureId) {
        service.revoke(userId, featureId);
    }
}
