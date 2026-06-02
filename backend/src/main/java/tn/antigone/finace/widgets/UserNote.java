package tn.antigone.finace.widgets;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_notes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserNote {
    @Id @GeneratedValue private UUID id;

    @Column(name = "user_id", nullable = false) private UUID userId;
    private String title;
    @Column(columnDefinition = "text") private String content;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(name = "updated_at")                     private Instant updatedAt;
}
