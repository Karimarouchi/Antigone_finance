package tn.antigone.finace.invoice;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "service_library")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ServiceLibraryEntry {
    @Id @GeneratedValue private UUID id;

    @Column(name = "category_id", nullable = false) private String categoryId;
    @Column(nullable = false) private String name;
    @Column(name = "created_at") private Instant createdAt;
}
