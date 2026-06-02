package tn.antigone.finace.payroll;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/irpp-baremes")
@RequiredArgsConstructor
@RequireFeature({ "decaissements-salaires", "decaissements" })
public class IrppBaremeController {

    private final IrppBaremeRepository repo;

    @GetMapping
    public List<IrppBareme> list() {
        return repo.findAllByOrderByEffectiveFromAsc();
    }

    /** Upsert by effective_from (YYYY-MM). */
    @PostMapping
    @Transactional
    public IrppBareme upsert(@RequestBody IrppBareme in) {
        if (in.getEffectiveFrom() == null || in.getBrackets() == null)
            throw new BadRequestException("effective_from et brackets requis");
        IrppBareme existing = repo.findAllByOrderByEffectiveFromAsc().stream()
                .filter(b -> b.getEffectiveFrom().equals(in.getEffectiveFrom()))
                .findFirst().orElse(null);
        if (existing != null) {
            in.setId(existing.getId());
            in.setCreatedAt(existing.getCreatedAt());
        }
        return repo.save(in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        if (!repo.existsById(id))
            throw new NotFoundException("Barème introuvable");
        repo.deleteById(id);
    }
}
