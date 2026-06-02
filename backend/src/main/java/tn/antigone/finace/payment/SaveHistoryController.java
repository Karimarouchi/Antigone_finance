package tn.antigone.finace.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.feature.RequireFeature;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequiredArgsConstructor
@RequireFeature({ "invoice", "invoice-creator", "encaissements-factures", "payments" })
public class SaveHistoryController {

    private final FactureHistoryRepository factures;
    private final DevisHistoryRepository devis;
    private final PaymentRepository payments;
    private final ObjectMapper mapper;

    public record SaveHistoryReq(
            String docType, String docNum,
            String clientId,
            String clientName, String clientMatricule,
            String dateIssued,
            BigDecimal ht, BigDecimal ttc, BigDecimal tvaAmt, BigDecimal timbre,
            String actionType, Integer version,
            Object payload) {
    }

    @PostMapping("/api/save-history")
    @Transactional
    public Map<String, Object> saveHistory(@RequestBody SaveHistoryReq r) {
        if (r.docNum() == null || r.docNum().isBlank())
            throw new BadRequestException("docNum requis");
        int version = (r.version() == null || r.version() < 1) ? 1 : r.version();
        String action = (r.actionType() == null || r.actionType().isBlank()) ? "created" : r.actionType();
        boolean isDevis = "Devis".equalsIgnoreCase(r.docType());

        if (isDevis) {
            DevisHistory existing = devis.findFirstByDevisNumberAndVersion(r.docNum(), version).orElse(null);
            DevisHistory row = existing != null ? existing : new DevisHistory();
            if (existing == null) {
                row.setDevisNumber(r.docNum());
                row.setVersion(version);
                row.setActionType(action);
                row.setCreatedAt(Instant.now());
            } else {
                row.setActionType(mergeAction(existing.getActionType(), action));
            }
            row.setClientName(r.clientName());
            row.setTotalHt(r.ht());
            row.setTotalTva(r.tvaAmt());
            row.setTotalTtc(r.ttc());
            if (r.payload() != null)
                row.setPayload(mapper.valueToTree(r.payload()));
            else if (row.getPayload() == null)
                row.setPayload(mapper.createObjectNode());
            devis.save(row);
            return Map.of("status", "ok", "id", row.getId());
        }

        FactureHistory existing = factures.findFirstByInvoiceNumberAndVersion(r.docNum(), version).orElse(null);
        FactureHistory row = existing != null ? existing : new FactureHistory();
        if (existing == null) {
            row.setInvoiceNumber(r.docNum());
            row.setVersion(version);
            row.setActionType(action);
            row.setCreatedAt(Instant.now());
        } else {
            row.setActionType(mergeAction(existing.getActionType(), action));
        }
        row.setClientName(r.clientName());
        row.setTotalHt(r.ht());
        row.setTotalTva(r.tvaAmt());
        row.setTotalTtc(r.ttc());
        if (r.payload() != null)
            row.setPayload(mapper.valueToTree(r.payload()));
        else if (row.getPayload() == null)
            row.setPayload(mapper.createObjectNode());
        factures.save(row);

        // Upsert payments row for factures
        Payment pay = payments.findFirstByInvoiceNumber(r.docNum()).orElse(null);
        if (pay == null) {
            pay = new Payment();
            pay.setInvoiceNumber(r.docNum());
            pay.setStatus("draft");
            pay.setAmountPaid(BigDecimal.ZERO);
        }
        pay.setClientName(r.clientName());
        if (r.clientId() != null && !r.clientId().isBlank()) {
            try {
                pay.setClientId(UUID.fromString(r.clientId()));
            } catch (IllegalArgumentException ignored) {
            }
        }
        pay.setTotalHt(r.ht());
        pay.setTotalTva(r.tvaAmt());
        pay.setTotalTtc(r.ttc());
        pay.setDateIssued(parseDate(r.dateIssued()));
        payments.save(pay);

        return Map.of("status", "ok", "id", row.getId(), "paymentId", pay.getId());
    }

    @GetMapping("/api/facture-history/by-num/{num}")
    public Map<String, Object> getFactureByNum(@PathVariable String num) {
        FactureHistory fh = factures.findAllByInvoiceNumberOrderByVersionDesc(num)
            .stream().findFirst()
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.NOT_FOUND, "Facture introuvable: " + num));
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("invoiceNumber", fh.getInvoiceNumber());
        result.put("clientName", fh.getClientName());
        result.put("totalHt", fh.getTotalHt());
        result.put("totalTva", fh.getTotalTva());
        result.put("totalTtc", fh.getTotalTtc());
        result.put("pdfKey", fh.getPdfKey());
        result.put("payload", fh.getPayload());
        return result;
    }

    // Snake-case aliases that frontend useHistory.ts calls
    @GetMapping("/api/facture_history")
    public List<FactureHistory> facturesSnake(@RequestParam(required = false) String invoice_number,
            @RequestParam(required = false) Integer version) {
        if (invoice_number != null && version != null) {
            return factures.findFirstByInvoiceNumberAndVersion(invoice_number, version)
                    .map(List::of).orElse(List.of());
        }
        if (invoice_number != null)
            return factures.findAllByInvoiceNumberOrderByVersionDesc(invoice_number);
        return factures.findAllByOrderByCreatedAtDesc();
    }

    @GetMapping("/api/devis_history")
    public List<DevisHistory> devisSnake(@RequestParam(required = false) String devis_number,
            @RequestParam(required = false) Integer version) {
        if (devis_number != null && version != null) {
            return devis.findFirstByDevisNumberAndVersion(devis_number, version)
                    .map(List::of).orElse(List.of());
        }
        if (devis_number != null)
            return devis.findAllByDevisNumberOrderByVersionDesc(devis_number);
        return devis.findAllByOrderByCreatedAtDesc();
    }

    private static String mergeAction(String existing, String add) {
        if (existing == null || existing.isBlank())
            return add;
        Set<String> parts = new LinkedHashSet<>(Arrays.asList(existing.split("\\s*,\\s*")));
        parts.add(add);
        return String.join(",", parts);
    }

    private static LocalDate parseDate(String s) {
        if (s == null || s.isBlank())
            return LocalDate.now();
        try {
            return LocalDate.parse(s.substring(0, Math.min(10, s.length())));
        } catch (Exception e) {
            return LocalDate.now();
        }
    }
}
