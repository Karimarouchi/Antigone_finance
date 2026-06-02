package tn.antigone.finace.dettes;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "dettes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Dette {
    @Id @GeneratedValue private UUID id;

    @Column(nullable = false) private String creancier;
    @Column(name = "montant_total", nullable = false) private BigDecimal montantTotal;
    @Column(name = "montant_paye",  nullable = false) private BigDecimal montantPaye = BigDecimal.ZERO;
    @Column(name = "date_echeance") private LocalDate dateEcheance;
    @Column(columnDefinition = "text", nullable = false) private String notes = "";
    @Column(name = "archived_at")   private Instant archivedAt;

    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(name = "updated_at")                     private Instant updatedAt;
}
