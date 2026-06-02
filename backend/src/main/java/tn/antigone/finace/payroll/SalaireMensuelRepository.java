package tn.antigone.finace.payroll;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SalaireMensuelRepository extends JpaRepository<SalaireMensuel, UUID> {
    List<SalaireMensuel> findAllByMois(String mois);
    List<SalaireMensuel> findAllByEmployeeIdOrderByMoisDesc(UUID employeeId);
    Optional<SalaireMensuel> findByEmployeeIdAndMois(UUID employeeId, String mois);
}
