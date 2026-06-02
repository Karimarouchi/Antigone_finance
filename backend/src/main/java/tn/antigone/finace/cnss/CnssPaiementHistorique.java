package tn.antigone.finace.cnss;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "cnss_paiement_historique")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CnssPaiementHistorique {
    @Id @GeneratedValue private UUID id;

    @Column(nullable = false) private Integer annee;
    @Column(nullable = false) private Integer trimestre;
    @Column(name = "montant_salarie",   nullable = false) private BigDecimal montantSalarie;
    @Column(name = "montant_employeur", nullable = false) private BigDecimal montantEmployeur;
    @Column(name = "montant_penalite",  nullable = false) private BigDecimal montantPenalite = BigDecimal.ZERO;
    @Column(name = "montant_total",     nullable = false) private BigDecimal montantTotal;
    @Column(name = "date_paiement",     nullable = false) private LocalDate datePaiement;
    @Column(columnDefinition = "text") private String note;
    @Column(name = "created_at") private Instant createdAt;
}
