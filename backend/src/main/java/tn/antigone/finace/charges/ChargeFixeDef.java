package tn.antigone.finace.charges;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "charge_fixe_def")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChargeFixeDef {
    @Id @GeneratedValue private UUID id;

    @Column(name = "group_id", nullable = false) private UUID groupId;
    @Column(nullable = false) private String label;
    @Column(nullable = false) private BigDecimal montant = BigDecimal.ZERO;
    @Column(name = "tva_taux", nullable = false) private BigDecimal tvaTaux = BigDecimal.ZERO;
    @Column(name = "jour_echeance", nullable = false) private Integer jourEcheance = 1;
    @Column(name = "cycle_months", nullable = false) private Integer cycleMonths = 1;

    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @Column(name = "archived_at") private Instant archivedAt;
    @UpdateTimestamp @Column(name = "updated_at") private Instant updatedAt;
}
