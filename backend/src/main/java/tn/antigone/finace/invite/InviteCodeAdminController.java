package tn.antigone.finace.invite;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.security.SecurityUtils;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/invites")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
public class InviteCodeAdminController {

    private final InviteCodeRepository repo;
    private static final SecureRandom RNG = new SecureRandom();
    private static final String ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public record CreateReq(String label, Instant expiresAt, String[] features) {}

    @GetMapping
    public List<InviteCode> list() { return repo.findAll(); }

    @PostMapping
    public InviteCode create(@RequestBody CreateReq r) {
        String code = randomCode(10);
        return repo.save(InviteCode.builder()
                .code(code)
                .label(r.label())
                .createdBy(SecurityUtils.currentUserId())
                .createdAt(Instant.now())
                .expiresAt(r.expiresAt())
                .features(r.features() == null ? new String[0] : r.features())
                .build());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { repo.deleteById(id); }

    private static String randomCode(int len) {
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) sb.append(ALPHA.charAt(RNG.nextInt(ALPHA.length())));
        return sb.toString();
    }
}
