package tn.antigone.finace.payroll;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EmployeePayrollSettingsRepository extends JpaRepository<EmployeePayrollSettings, UUID> {
    List<EmployeePayrollSettings> findAllByEmployeeIdOrderByEffectiveFromAsc(UUID employeeId);

    List<EmployeePayrollSettings> findAllByOrderByEffectiveFromAsc();
}
