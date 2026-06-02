package tn.antigone.finace.cnss;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.feature.RequireFeature;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/cnss")
@RequiredArgsConstructor
@RequireFeature({"decaissements-cnss", "decaissements"})
public class CnssController {

    private final CnssTrimestreRepository trimestres;
    private final CnssPaiementHistoriqueRepository historique;

    @GetMapping("/trimestres")
    public List<CnssTrimestre> list(@RequestParam(required = false) Integer annee) {
        return annee == null ? trimestres.findAll() : trimestres.findAllByAnneeOrderByTrimestreAsc(annee);
    }

    @GetMapping("/trimestres/{annee}/{trimestre}")
    public CnssTrimestre get(@PathVariable Integer annee, @PathVariable Integer trimestre) {
        return trimestres.findByAnneeAndTrimestre(annee, trimestre).orElse(null);
    }

    @PostMapping("/trimestres")
    @Transactional
    public CnssTrimestre upsert(@RequestBody CnssTrimestre in) {
        if (in.getAnnee() == null || in.getTrimestre() == null)
            throw new BadRequestException("annee/trimestre requis");
        CnssTrimestre existing = trimestres
                .findByAnneeAndTrimestre(in.getAnnee(), in.getTrimestre()).orElse(null);
        if (existing != null) {
            in.setId(existing.getId());
            in.setCreatedAt(existing.getCreatedAt());
        }
        return trimestres.save(in);
    }

    @PostMapping("/trimestres/{annee}/{trimestre}/pay")
    @Transactional
    public CnssTrimestre pay(@PathVariable Integer annee, @PathVariable Integer trimestre,
                             @RequestBody PayRequest req) {
        CnssTrimestre t = trimestres.findByAnneeAndTrimestre(annee, trimestre)
                .orElseGet(() -> CnssTrimestre.builder().annee(annee).trimestre(trimestre).build());

        BigDecimal s = nz(req.montantSalarie());
        BigDecimal e = nz(req.montantEmployeur());
        BigDecimal p = nz(req.montantPenalite());
        t.setMontantSalarie(s);
        t.setMontantEmployeur(e);
        t.setMontantPenalite(p);
        t.setMontantTotal(s.add(e).add(p));
        t.setDatePaiement(Instant.now());
        t.setStatut("payee");
        trimestres.save(t);

        historique.save(CnssPaiementHistorique.builder()
                .annee(annee).trimestre(trimestre)
                .montantSalarie(s).montantEmployeur(e).montantPenalite(p)
                .montantTotal(s.add(e).add(p))
                .datePaiement(LocalDate.now())
                .note(req.note())
                .createdAt(Instant.now())
                .build());
        return t;
    }

    @GetMapping("/historique/{annee}/{trimestre}")
    public List<CnssPaiementHistorique> historyByQuarter(@PathVariable Integer annee,
                                                         @PathVariable Integer trimestre) {
        return historique.findAllByAnneeAndTrimestreOrderByDatePaiementDesc(annee, trimestre);
    }

    @DeleteMapping("/trimestres/{id}")
    public void delete(@PathVariable UUID id) { trimestres.deleteById(id); }

    private static BigDecimal nz(BigDecimal v) { return v == null ? BigDecimal.ZERO : v; }

    public record PayRequest(BigDecimal montantSalarie, BigDecimal montantEmployeur,
                             BigDecimal montantPenalite, String note) {}
}
