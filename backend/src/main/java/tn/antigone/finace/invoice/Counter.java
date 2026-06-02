package tn.antigone.finace.invoice;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "counters")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Counter {
    @Id
    private String type; // 'facture' | 'devis'

    @Column(name = "last_number", nullable = false)
    private String lastNumber;

    @Column(name = "updated_at")
    private Instant updatedAt;
}
