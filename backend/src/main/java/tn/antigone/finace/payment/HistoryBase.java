package tn.antigone.finace.payment;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.*;
import tn.antigone.finace.common.JsonNodeConverter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@MappedSuperclass
@Getter @Setter @NoArgsConstructor
public abstract class HistoryBase {
    @Id @GeneratedValue private UUID id;

    @Column(nullable = false)              private Integer version = 1;
    @Column(name = "action_type", nullable = false) private String actionType = "created";

    @Column(name = "client_id")   private UUID clientId;
    @Column(name = "client_name") private String clientName;

    @Column(name = "total_ht")  private BigDecimal totalHt;
    @Column(name = "total_tva") private BigDecimal totalTva;
    @Column(name = "total_ttc") private BigDecimal totalTtc;
    @Column(name = "pdf_key")   private String pdfKey;

    @Convert(converter = JsonNodeConverter.class)
    @Column(columnDefinition = "jsonb")
    private JsonNode payload;

    @Column(name = "created_at") private Instant createdAt;
}
