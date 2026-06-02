package tn.antigone.finace.dettes;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/dettes")
@RequiredArgsConstructor
@RequireFeature({ "decaissements-dettes", "decaissements" })
public class DetteController {

    private final DetteRepository dettes;
    private final DettePaiementRepository paiements;

    @GetMapping
    public List<Dette> list(@RequestParam(defaultValue = "false") boolean includeArchived) {
        return includeArchived ? dettes.findAll() : dettes.findAllByArchivedAtIsNullOrderByDateEcheanceAsc();
    }

    @PostMapping
    public Dette create(@RequestBody Dette in) {
        in.setId(null);
        in.setArchivedAt(null);
        if (in.getMontantPaye() == null)
            in.setMontantPaye(BigDecimal.ZERO);
        return dettes.save(in);
    }

    @PutMapping("/{id}")
    public Dette update(@PathVariable UUID id, @RequestBody Dette in) {
        Dette existing = dettes.findById(id).orElseThrow(() -> new NotFoundException("Dette introuvable"));
        in.setId(existing.getId());
        in.setCreatedAt(existing.getCreatedAt());
        return dettes.save(in);
    }

    @DeleteMapping("/{id}")
    public void archive(@PathVariable UUID id) {
        Dette d = dettes.findById(id).orElseThrow(() -> new NotFoundException("Dette introuvable"));
        d.setArchivedAt(Instant.now());
        dettes.save(d);
    }

    // ── Paiements ────────────────────────────────────────────────────────────
    @GetMapping("/paiements")
    public List<DettePaiement> allPaiements() {
        return paiements.findAll();
    }

    @GetMapping("/{id}/paiements")
    public List<DettePaiement> listPaiements(@PathVariable("id") UUID detteId) {
        return paiements.findAllByDetteIdOrderByDateAsc(detteId);
    }

    @PostMapping("/{id}/paiements")
    @Transactional
    public DettePaiement addPaiement(@PathVariable("id") UUID detteId, @RequestBody DettePaiement p) {
        if (p.getMontant() == null || p.getMontant().signum() <= 0)
            throw new BadRequestException("Montant invalide");
        p.setId(null);
        p.setDetteId(detteId);
        if (p.getDate() == null)
            p.setDate(LocalDate.now());
        p.setCreatedAt(Instant.now());
        DettePaiement saved = paiements.save(p);

        Dette d = dettes.findById(detteId).orElseThrow();
        d.setMontantPaye(d.getMontantPaye().add(p.getMontant()));
        dettes.save(d);
        return saved;
    }

    @DeleteMapping("/paiements/{id}")
    @Transactional
    public void deletePaiement(@PathVariable UUID id) {
        DettePaiement p = paiements.findById(id)
                .orElseThrow(() -> new NotFoundException("Paiement introuvable"));
        Dette d = dettes.findById(p.getDetteId()).orElseThrow();
        BigDecimal newAmount = d.getMontantPaye().subtract(p.getMontant());
        if (newAmount.signum() < 0)
            newAmount = BigDecimal.ZERO;
        d.setMontantPaye(newAmount);
        dettes.save(d);
        paiements.deleteById(id);
    }
}
