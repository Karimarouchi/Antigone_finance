package tn.antigone.finace.invoice;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tn.antigone.finace.common.JsonNodeConverter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "templates")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Template {
    @Id @GeneratedValue private UUID id;

    @Column(nullable = false, unique = true)
    private String name;

    @Convert(converter = JsonNodeConverter.class)
    @Column(columnDefinition = "jsonb", nullable = false)
    private JsonNode data;

    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(name = "updated_at")                     private Instant updatedAt;
}
