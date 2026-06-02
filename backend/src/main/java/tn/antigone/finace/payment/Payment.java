package tn.antigone.finace.payment;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "payments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Payment {
    @Id @GeneratedValue private UUID id;

    @Column(name = "invoice_number", nullable = false) private String invoiceNumber;
    @Column(name = "client_id")    private UUID clientId;
    @Column(name = "client_name")  private String clientName;
    @Column(name = "date_issued", nullable = false) private LocalDate dateIssued;
    @Column(name = "sent_at")      private Instant sentAt;
    @Column(name = "paid_at")      private Instant paidAt;
    @Column(nullable = false)      private String status = "draft";
    @Column(name = "total_ht")     private BigDecimal totalHt = BigDecimal.ZERO;
    @Column(name = "total_tva")    private BigDecimal totalTva = BigDecimal.ZERO;
    @Column(name = "total_ttc")    private BigDecimal totalTtc = BigDecimal.ZERO;
    @Column(name = "amount_paid")  private BigDecimal amountPaid = BigDecimal.ZERO;
    @Column(name = "pdf_key")      private String pdfKey;
    @Column(columnDefinition = "text") private String notes;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(name = "updated_at")                     private Instant updatedAt;
}
