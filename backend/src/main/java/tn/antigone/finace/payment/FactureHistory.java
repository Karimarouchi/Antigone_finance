package tn.antigone.finace.payment;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "facture_history",
        uniqueConstraints = @UniqueConstraint(columnNames = {"invoice_number", "version"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class FactureHistory extends HistoryBase {
    @Column(name = "invoice_number", nullable = false)
    private String invoiceNumber;
}
