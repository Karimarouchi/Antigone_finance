package tn.antigone.finace.charges;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/charges")
@RequiredArgsConstructor
@RequireFeature({ "decaissements-charges", "decaissements" })
public class ChargesController {

    private final ChargeFixeDefRepository defs;
    private final ChargeFixePaiementRepository paiements;
    private final ChargeVariableRepository variables;

    // ── Fixed charges definitions ────────────────────────────────────────────
    @GetMapping("/fixes")
    public List<ChargeFixeDef> listFixes(@RequestParam(defaultValue = "false") boolean includeArchived) {
        return includeArchived ? defs.findAll() : defs.findAllByArchivedAtIsNull();
    }

    @PostMapping("/fixes")
    public ChargeFixeDef createFixe(@RequestBody ChargeFixeDef in) {
        in.setId(null);
        if (in.getGroupId() == null)
            in.setGroupId(UUID.randomUUID());
        in.setArchivedAt(null);
        return defs.save(in);
    }

    @PutMapping("/fixes/{id}")
    @Transactional
    public ChargeFixeDef updateFixe(@PathVariable UUID id, @RequestBody ChargeFixeDef in) {
        ChargeFixeDef existing = defs.findById(id)
                .orElseThrow(() -> new NotFoundException("Charge fixe introuvable"));
        in.setId(existing.getId());
        in.setGroupId(existing.getGroupId());
        in.setCreatedAt(existing.getCreatedAt());
        return defs.save(in);
    }

    /** Archive (does not delete linked paiements). */
    @DeleteMapping("/fixes/{id}")
    public void archiveFixe(@PathVariable UUID id) {
        ChargeFixeDef d = defs.findById(id)
                .orElseThrow(() -> new NotFoundException("Charge fixe introuvable"));
        d.setArchivedAt(Instant.now());
        defs.save(d);
    }

    // ── Paiements ────────────────────────────────────────────────────────────
    @GetMapping("/fixes/{id}/paiements")
    public List<ChargeFixePaiement> listPaiements(@PathVariable("id") UUID chargeId) {
        return paiements.findAllByChargeIdOrderByMoisDesc(chargeId);
    }

    @PostMapping("/fixes/{id}/paiements")
    public ChargeFixePaiement addPaiement(@PathVariable("id") UUID chargeId,
            @RequestBody ChargeFixePaiement p) {
        p.setId(null);
        p.setChargeId(chargeId);
        if (p.getDatePaiement() == null)
            p.setDatePaiement(Instant.now());
        p.setCreatedAt(Instant.now());
        return paiements.save(p);
    }

    @DeleteMapping("/fixes/paiements/{id}")
    public void deletePaiement(@PathVariable UUID id) {
        paiements.deleteById(id);
    }

    // ── Variable charges ─────────────────────────────────────────────────────
    @GetMapping("/variables")
    public List<ChargeVariable> listVariables(@RequestParam(required = false) String mois) {
        return mois == null ? variables.findAll() : variables.findAllByMoisOrderByDateAsc(mois);
    }

    @PostMapping("/variables")
    public ChargeVariable createVariable(@RequestBody ChargeVariable in) {
        in.setId(null);
        return variables.save(in);
    }

    @PutMapping("/variables/{id}")
    public ChargeVariable updateVariable(@PathVariable UUID id, @RequestBody ChargeVariable in) {
        ChargeVariable existing = variables.findById(id)
                .orElseThrow(() -> new NotFoundException("Charge variable introuvable"));
        in.setId(existing.getId());
        in.setCreatedAt(existing.getCreatedAt());
        return variables.save(in);
    }

    @DeleteMapping("/variables/{id}")
    public void deleteVariable(@PathVariable UUID id) {
        variables.deleteById(id);
    }
}
