package tn.antigone.finace.payroll;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface IrppBaremeRepository extends JpaRepository<IrppBareme, UUID> {
    List<IrppBareme> findAllByOrderByEffectiveFromAsc();
}
