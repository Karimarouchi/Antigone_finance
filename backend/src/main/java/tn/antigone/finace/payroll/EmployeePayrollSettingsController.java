package tn.antigone.finace.payroll;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.feature.RequireFeature;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/employee-payroll-settings")
@RequiredArgsConstructor
@RequireFeature({ "decaissements-salaires", "decaissements" })
public class EmployeePayrollSettingsController {

    private final EmployeePayrollSettingsRepository repo;

    @GetMapping
    public List<EmployeePayrollSettings> list() {
        return repo.findAllByOrderByEffectiveFromAsc();
    }

    @GetMapping("/{employeeId}")
    public List<EmployeePayrollSettings> byEmployee(@PathVariable UUID employeeId) {
        return repo.findAllByEmployeeIdOrderByEffectiveFromAsc(employeeId);
    }

    /** Upsert by (employee_id, effective_from). */
    @PostMapping
    @Transactional
    public EmployeePayrollSettings upsert(@RequestBody EmployeePayrollSettings in) {
        if (in.getEmployeeId() == null || in.getEffectiveFrom() == null)
            throw new BadRequestException("employee_id et effective_from requis");
        EmployeePayrollSettings existing = repo
                .findAllByEmployeeIdOrderByEffectiveFromAsc(in.getEmployeeId()).stream()
                .filter(s -> s.getEffectiveFrom().equals(in.getEffectiveFrom()))
                .findFirst().orElse(null);
        if (existing != null) {
            in.setId(existing.getId());
            in.setCreatedAt(existing.getCreatedAt());
        }
        return repo.save(in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        repo.deleteById(id);
    }
}
