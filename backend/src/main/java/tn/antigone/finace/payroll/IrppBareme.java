package tn.antigone.finace.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tn.antigone.finace.common.JsonNodeConverter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "irpp_baremes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class IrppBareme {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "effective_from", nullable = false, length = 7, unique = true)
    private String effectiveFrom;

    @Convert(converter = JsonNodeConverter.class)
    @Column(columnDefinition = "jsonb", nullable = false)
    private JsonNode brackets;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
