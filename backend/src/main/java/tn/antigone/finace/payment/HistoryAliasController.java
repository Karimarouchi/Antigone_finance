package tn.antigone.finace.payment;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.feature.RequireFeature;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import tn.antigone.finace.common.NotFoundException;

@RestController
@RequiredArgsConstructor
@RequireFeature({ "invoice", "invoice-creator", "encaissements-factures" })
public class HistoryAliasController {

    private final FactureHistoryRepository factures;
    private final DevisHistoryRepository devis;

    @GetMapping("/api/facture-history")
    public List<FactureHistory> factures(@RequestParam(required = false) String invoiceNumber) {
        return invoiceNumber == null
                ? factures.findAllByOrderByCreatedAtDesc()
                : factures.findAllByInvoiceNumberOrderByVersionDesc(invoiceNumber);
    }

    @PostMapping("/api/facture-history")
    public FactureHistory saveFacture(@RequestBody FactureHistory in) {
        in.setId(null);
        if (in.getCreatedAt() == null)
            in.setCreatedAt(Instant.now());
        return factures.save(in);
    }

    @GetMapping("/api/devis-history")
    public List<DevisHistory> devis(@RequestParam(required = false) String devisNumber) {
        return devisNumber == null
                ? devis.findAllByOrderByCreatedAtDesc()
                : devis.findAllByDevisNumberOrderByVersionDesc(devisNumber);
    }

    @PostMapping("/api/devis-history")
    public DevisHistory saveDevis(@RequestBody DevisHistory in) {
        in.setId(null);
        if (in.getCreatedAt() == null)
            in.setCreatedAt(Instant.now());
        return devis.save(in);
    }

    @DeleteMapping("/api/facture-history/{id}")
    public ResponseEntity<Void> deleteFacture(@PathVariable UUID id) {
        FactureHistory row = factures.findById(id)
                .orElseThrow(() -> new NotFoundException("Facture introuvable"));
        factures.delete(row);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/devis-history/{id}")
    public ResponseEntity<Void> deleteDevis(@PathVariable UUID id) {
        DevisHistory row = devis.findById(id)
                .orElseThrow(() -> new NotFoundException("Devis introuvable"));
        devis.delete(row);
        return ResponseEntity.noContent().build();
    }
}
