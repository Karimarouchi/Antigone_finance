package tn.antigone.finace.messaging;

import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.security.SecurityUtils;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageRepository repo;
    private final SimpMessagingTemplate ws;

    public record SendReq(UUID recipientId, String content, UUID replyToId, Instant expiresAt) {}

    @GetMapping("/inbox")
    public List<Message> inbox() { return repo.inbox(SecurityUtils.currentUserId()); }

    @GetMapping("/conversation/{otherId}")
    public List<Message> conversation(@PathVariable UUID otherId) {
        return repo.conversation(SecurityUtils.currentUserId(), otherId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unread() {
        return Map.of("count",
                repo.countByRecipientIdAndSeenAtIsNullAndDeletedAtIsNull(SecurityUtils.currentUserId()));
    }

    @PostMapping
    @Transactional
    public Message send(@RequestBody SendReq r) {
        if (r.content() == null || r.content().isBlank()) throw new BadRequestException("Contenu vide");
        Message m = repo.save(Message.builder()
                .senderId(SecurityUtils.currentUserId())
                .recipientId(r.recipientId())
                .content(r.content())
                .replyToId(r.replyToId())
                .expiresAt(r.expiresAt())
                .build());
        ws.convertAndSend("/topic/messages/" + r.recipientId(), m);
        ws.convertAndSend("/topic/messages/" + m.getSenderId(), m);
        return m;
    }

    @PostMapping("/{id}/seen")
    @Transactional
    public Message markSeen(@PathVariable UUID id) {
        Message m = repo.findById(id).orElseThrow(() -> new NotFoundException("Message introuvable"));
        if (!m.getRecipientId().equals(SecurityUtils.currentUserId()))
            throw new NotFoundException("Message introuvable");
        if (m.getSeenAt() == null) m.setSeenAt(Instant.now());
        return m;
    }

    @PostMapping("/{id}/pin")
    @Transactional
    public Message pin(@PathVariable UUID id, @RequestParam(defaultValue = "true") boolean pinned) {
        Message m = repo.findById(id).orElseThrow(() -> new NotFoundException("Message introuvable"));
        UUID me = SecurityUtils.currentUserId();
        if (!m.getRecipientId().equals(me) && !m.getSenderId().equals(me))
            throw new NotFoundException("Message introuvable");
        m.setPinned(pinned);
        return m;
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void delete(@PathVariable UUID id) {
        Message m = repo.findById(id).orElseThrow(() -> new NotFoundException("Message introuvable"));
        UUID me = SecurityUtils.currentUserId();
        if (!m.getSenderId().equals(me)) throw new NotFoundException("Message introuvable");
        m.setDeletedAt(Instant.now());
    }
}
