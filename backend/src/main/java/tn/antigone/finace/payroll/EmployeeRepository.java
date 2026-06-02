package tn.antigone.finace.payroll;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EmployeeRepository extends JpaRepository<Employee, UUID> {
    List<Employee> findAllByArchivedAtIsNullOrderByNomAscPrenomAsc();
    List<Employee> findAllByArchivedAtIsNotNull();
}
