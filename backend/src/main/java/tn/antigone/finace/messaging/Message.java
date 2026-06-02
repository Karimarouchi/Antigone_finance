package tn.antigone.finace.messaging;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "messages")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Message {
    @Id @GeneratedValue private UUID id;

    @Column(name = "sender_id",    nullable = false) private UUID senderId;
    @Column(name = "recipient_id", nullable = false) private UUID recipientId;
    @Column(columnDefinition = "text", nullable = false) private String content;
    @Column(name = "reply_to_id") private UUID replyToId;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @Column(name = "seen_at")    private Instant seenAt;
    @Column(name = "expires_at") private Instant expiresAt;
    @Column(nullable = false)    private boolean pinned;
    @Column(name = "deleted_at") private Instant deletedAt;
}
