package tn.antigone.finace.charges;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "charge_variable")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChargeVariable {
    @Id @GeneratedValue private UUID id;

    @Column(length = 7, nullable = false) private String mois;
    @Column(nullable = false) private String label;
    @Column(nullable = false) private BigDecimal montant = BigDecimal.ZERO;
    @Column(name = "tva_taux", nullable = false) private BigDecimal tvaTaux = BigDecimal.ZERO;
    @Column(nullable = false) private LocalDate date;
    @Column(nullable = false) private String categorie = "autre";
    @Column(columnDefinition = "text", nullable = false) private String description = "";

    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(name = "updated_at")                     private Instant updatedAt;
}
