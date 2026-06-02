package tn.antigone.finace.payroll;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SalaryPartialRepository extends JpaRepository<SalaryPartial, UUID> {
    List<SalaryPartial> findAllByEmployeeIdAndMoisOrderByDateAsc(UUID employeeId, String mois);
}
