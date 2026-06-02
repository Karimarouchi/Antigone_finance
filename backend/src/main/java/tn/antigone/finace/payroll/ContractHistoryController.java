package tn.antigone.finace.payroll;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.feature.RequireFeature;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Flat contract-history endpoints consumed by the ported Salaires hooks
 * (global fetch + upsert by employee_id + effective_from).
 */
@RestController
@RequestMapping("/api/contract-history")
@RequiredArgsConstructor
@RequireFeature({ "decaissements-salaires", "decaissements" })
public class ContractHistoryController {

    private final EmployeeContractHistoryRepository repo;

    @GetMapping
    public List<EmployeeContractHistory> list() {
        return repo.findAllByOrderByEffectiveFromAsc();
    }

    /** Upsert by (employee_id, effective_from). */
    @PostMapping
    @Transactional
    public EmployeeContractHistory upsert(@RequestBody EmployeeContractHistory in) {
        if (in.getEmployeeId() == null || in.getEffectiveFrom() == null)
            throw new BadRequestException("employee_id et effective_from requis");
        EmployeeContractHistory existing = repo
                .findByEmployeeIdAndEffectiveFrom(in.getEmployeeId(), in.getEffectiveFrom())
                .orElse(null);
        if (existing != null) {
            in.setId(existing.getId());
            in.setCreatedAt(existing.getCreatedAt());
        }
        if (in.getCreatedAt() == null)
            in.setCreatedAt(Instant.now());
        if (in.getSalaryMode() == null)
            in.setSalaryMode("base");
        return repo.save(in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        repo.deleteById(id);
    }
}
