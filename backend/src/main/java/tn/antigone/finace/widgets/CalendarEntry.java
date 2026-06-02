package tn.antigone.finace.widgets;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "calendar_entries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CalendarEntry {
    @Id @GeneratedValue private UUID id;

    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(nullable = false) private LocalDate date;
    @Column(nullable = false) private String title;
    @Column(columnDefinition = "text") private String note;
    @Column(nullable = false) private String color = "#e8621a";
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(name = "updated_at")                     private Instant updatedAt;
}
