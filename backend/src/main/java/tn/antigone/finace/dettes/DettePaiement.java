package tn.antigone.finace.dettes;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "dette_paiements")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DettePaiement {
    @Id @GeneratedValue private UUID id;

    @Column(name = "dette_id", nullable = false) private UUID detteId;
    @Column(nullable = false) private BigDecimal montant;
    @Column(nullable = false) private LocalDate date;
    @Column(columnDefinition = "text") private String note;
    @Column(name = "created_at") private Instant createdAt;
}
