package tn.antigone.finace.messaging;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.security.SecurityUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepository repo;
    private final NotificationService service;

    @GetMapping
    public List<Notification> mine() {
        return repo.findAllByUserIdOrderByCreatedAtDesc(SecurityUtils.currentUserId());
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount() {
        return Map.of("count", repo.countByUserIdAndReadAtIsNull(SecurityUtils.currentUserId()));
    }

    @PostMapping("/{id}/read")
    @Transactional
    public Notification markRead(@PathVariable UUID id) {
        Notification n = repo.findById(id).orElseThrow(() -> new NotFoundException("Notification introuvable"));
        if (!n.getUserId().equals(SecurityUtils.currentUserId()))
            throw new NotFoundException("Notification introuvable");
        if (n.getReadAt() == null) n.setReadAt(Instant.now());
        return n;
    }

    @PostMapping("/read-all")
    public void readAll() { service.markAllRead(SecurityUtils.currentUserId()); }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        Notification n = repo.findById(id).orElseThrow(() -> new NotFoundException("Notification introuvable"));
        if (!n.getUserId().equals(SecurityUtils.currentUserId()))
            throw new NotFoundException("Notification introuvable");
        repo.deleteById(id);
    }

    // ── Admin broadcast ──────────────────────────────────────────────────────
    public record BroadcastReq(String title, String body, String type, String link) {}

    @PostMapping("/admin/broadcast")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public void broadcast(@RequestBody BroadcastReq r) {
        service.broadcast(r.title(), r.body(), r.type(), r.link());
    }
}
