package tn.antigone.finace.charges;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "charge_fixe_paiement")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ChargeFixePaiement {
    @Id @GeneratedValue private UUID id;

    @Column(name = "charge_id", nullable = false) private UUID chargeId;
    @Column(length = 7, nullable = false) private String mois;
    @Column(nullable = false) private BigDecimal montant;
    @Column(name = "date_paiement", nullable = false) private Instant datePaiement;
    @Column(name = "created_at") private Instant createdAt;
}
