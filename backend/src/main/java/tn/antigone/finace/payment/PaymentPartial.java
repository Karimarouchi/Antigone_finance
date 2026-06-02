package tn.antigone.finace.payment;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "payment_partials")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PaymentPartial {
    @Id @GeneratedValue private UUID id;

    @Column(name = "payment_id", nullable = false) private UUID paymentId;
    @Column(nullable = false) private BigDecimal montant;
    @Column(nullable = false) private LocalDate date;
    @Column(nullable = false) private String note = "";
    @Column(name = "created_at") private Instant createdAt;
}
