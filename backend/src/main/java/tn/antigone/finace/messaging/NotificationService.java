package tn.antigone.finace.messaging;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tn.antigone.finace.user.AppUserRepository;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repo;
    private final SimpMessagingTemplate ws;
    private final AppUserRepository users;

    @Transactional
    public Notification push(UUID userId, String title, String body, String type, String link) {
        Notification n = repo.save(Notification.builder()
                .userId(userId).title(title).body(body)
                .type(type == null ? "info" : type).link(link).build());
        ws.convertAndSend("/topic/notifications/" + userId, n);
        return n;
    }

    /** Broadcast to every active user (replaces the SECURITY DEFINER notify_all helper). */
    @Transactional
    public void broadcast(String title, String body, String type, String link) {
        users.findAll().forEach(u ->
                push(u.getId(), title, body, type, link));
    }

    @Transactional
    public void markAllRead(UUID userId) {
        repo.findAllByUserIdOrderByCreatedAtDesc(userId).forEach(n -> {
            if (n.getReadAt() == null) n.setReadAt(Instant.now());
        });
    }
}
