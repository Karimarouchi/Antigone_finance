package tn.antigone.finace.payment;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "devis_history",
        uniqueConstraints = @UniqueConstraint(columnNames = {"devis_number", "version"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class DevisHistory extends HistoryBase {
    @Column(name = "devis_number", nullable = false)
    private String devisNumber;
}
