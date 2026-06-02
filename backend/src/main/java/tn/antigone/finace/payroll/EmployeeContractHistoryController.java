package tn.antigone.finace.payroll;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.feature.RequireFeature;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/employees/{employeeId}/contracts")
@RequiredArgsConstructor
@RequireFeature({"decaissements-salaires", "decaissements"})
public class EmployeeContractHistoryController {

    private final EmployeeContractHistoryRepository repo;

    @GetMapping
    public List<EmployeeContractHistory> list(@PathVariable UUID employeeId) {
        return repo.findAllByEmployeeIdOrderByEffectiveFromDesc(employeeId);
    }

    @PostMapping
    public EmployeeContractHistory create(@PathVariable UUID employeeId,
                                          @RequestBody EmployeeContractHistory in) {
        in.setId(null);
        in.setEmployeeId(employeeId);
        if (in.getCreatedAt() == null) in.setCreatedAt(Instant.now());
        return repo.save(in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { repo.deleteById(id); }
}
