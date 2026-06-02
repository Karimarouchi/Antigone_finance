package tn.antigone.finace.payment;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.feature.RequireFeature;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
@RequireFeature({"invoice"})
public class HistoryController {

    private final FactureHistoryRepository factures;
    private final DevisHistoryRepository devis;

    @GetMapping("/factures")
    public List<FactureHistory> factures(@RequestParam(required = false) String invoiceNumber) {
        return invoiceNumber == null
                ? factures.findAllByOrderByCreatedAtDesc()
                : factures.findAllByInvoiceNumberOrderByVersionDesc(invoiceNumber);
    }

    @GetMapping("/devis")
    public List<DevisHistory> devis(@RequestParam(required = false) String devisNumber) {
        return devisNumber == null
                ? devis.findAllByOrderByCreatedAtDesc()
                : devis.findAllByDevisNumberOrderByVersionDesc(devisNumber);
    }

    @PostMapping("/factures")
    public FactureHistory saveFacture(@RequestBody FactureHistory in) {
        in.setId(null);
        if (in.getCreatedAt() == null) in.setCreatedAt(Instant.now());
        return factures.save(in);
    }

    @PostMapping("/devis")
    public DevisHistory saveDevis(@RequestBody DevisHistory in) {
        in.setId(null);
        if (in.getCreatedAt() == null) in.setCreatedAt(Instant.now());
        return devis.save(in);
    }
}
