package tn.antigone.finace.payroll;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tn.antigone.finace.common.JsonNodeConverter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "salaire_mensuel", uniqueConstraints = @UniqueConstraint(columnNames = { "employee_id", "mois" }))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SalaireMensuel {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "employee_id", nullable = false)
    private UUID employeeId;
    @Column(nullable = false, length = 7)
    private String mois;

    @Column(nullable = false)
    private BigDecimal bonus = BigDecimal.ZERO;
    @Column(nullable = false)
    private BigDecimal acompte = BigDecimal.ZERO;
    @Column(name = "jours_absent", nullable = false)
    private BigDecimal joursAbsent = BigDecimal.ZERO;

    @Convert(converter = JsonNodeConverter.class)
    @Column(name = "salary_elements", columnDefinition = "jsonb")
    private JsonNode salaryElements;

    @Column(name = "salaire_paye", nullable = false)
    private boolean salairePaye;
    @Column(name = "date_paiement")
    private Instant datePaiement;
    @Column(name = "montant_paye", nullable = false)
    private BigDecimal montantPaye = BigDecimal.ZERO;

    @Column(name = "snap_brut_effectif")
    private BigDecimal snapBrutEffectif;
    @Column(name = "snap_cnss_salarie")
    private BigDecimal snapCnssSalarie;
    @Column(name = "snap_irpp_mensuel")
    private BigDecimal snapIrppMensuel;
    // SnakeCaseStrategy would emit "snap_net_apayer"; pin it to match the DB column
    // and frontend.
    @JsonProperty("snap_net_a_payer")
    @Column(name = "snap_net_a_payer")
    private BigDecimal snapNetAPayer;
    @Column(name = "snap_cout_total")
    private BigDecimal snapCoutTotal;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
