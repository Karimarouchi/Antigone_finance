package tn.antigone.finace.payroll;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmployeeContractHistoryRepository extends JpaRepository<EmployeeContractHistory, UUID> {
    List<EmployeeContractHistory> findAllByEmployeeIdOrderByEffectiveFromDesc(UUID employeeId);

    List<EmployeeContractHistory> findAllByOrderByEffectiveFromAsc();

    Optional<EmployeeContractHistory> findByEmployeeIdAndEffectiveFrom(UUID employeeId, String effectiveFrom);
}
