package tn.antigone.finace.revenus;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/autres-revenus")
@RequiredArgsConstructor
@RequireFeature({"encaissements", "encaissements-autres"})
public class AutreRevenuController {

    private final AutreRevenuRepository repo;

    @GetMapping
    public List<AutreRevenu> list(@RequestParam(required = false) LocalDate from,
                                  @RequestParam(required = false) LocalDate to) {
        if (from != null && to != null) return repo.findAllByDateBetweenOrderByDateDesc(from, to);
        return repo.findAllByOrderByDateDesc();
    }

    @PostMapping
    public AutreRevenu create(@RequestBody AutreRevenu in) { in.setId(null); return repo.save(in); }

    @PutMapping("/{id}")
    public AutreRevenu update(@PathVariable UUID id, @RequestBody AutreRevenu in) {
        AutreRevenu existing = repo.findById(id).orElseThrow(() -> new NotFoundException("Revenu introuvable"));
        in.setId(existing.getId());
        in.setCreatedAt(existing.getCreatedAt());
        return repo.save(in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { repo.deleteById(id); }
}
