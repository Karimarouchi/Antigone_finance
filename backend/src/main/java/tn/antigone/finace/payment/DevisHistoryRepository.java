package tn.antigone.finace.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DevisHistoryRepository extends JpaRepository<DevisHistory, UUID> {
    List<DevisHistory> findAllByDevisNumberOrderByVersionDesc(String devisNumber);

    List<DevisHistory> findAllByOrderByCreatedAtDesc();

    java.util.Optional<DevisHistory> findFirstByDevisNumberAndVersion(String devisNumber, Integer version);
}
