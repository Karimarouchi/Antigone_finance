package tn.antigone.finace.revenus;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface AutreRevenuRepository extends JpaRepository<AutreRevenu, UUID> {
    List<AutreRevenu> findAllByDateBetweenOrderByDateDesc(LocalDate from, LocalDate to);
    List<AutreRevenu> findAllByOrderByDateDesc();
}
