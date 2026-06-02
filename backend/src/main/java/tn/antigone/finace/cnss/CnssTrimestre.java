package tn.antigone.finace.cnss;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "cnss_trimestre",
        uniqueConstraints = @UniqueConstraint(columnNames = {"annee", "trimestre"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CnssTrimestre {
    @Id @GeneratedValue private UUID id;

    @Column(nullable = false) private Integer annee;
    @Column(nullable = false) private Integer trimestre;
    @Column(name = "montant_salarie",   nullable = false) private BigDecimal montantSalarie = BigDecimal.ZERO;
    @Column(name = "montant_employeur", nullable = false) private BigDecimal montantEmployeur = BigDecimal.ZERO;
    @Column(name = "montant_penalite",  nullable = false) private BigDecimal montantPenalite = BigDecimal.ZERO;
    @Column(name = "montant_total",     nullable = false) private BigDecimal montantTotal = BigDecimal.ZERO;
    @Column(name = "date_paiement") private Instant datePaiement;
    @Column(nullable = false) private String statut = "due";

    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(name = "updated_at")                     private Instant updatedAt;
}
