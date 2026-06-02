package tn.antigone.finace.dettes;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DettePaiementRepository extends JpaRepository<DettePaiement, UUID> {
    List<DettePaiement> findAllByDetteIdOrderByDateAsc(UUID detteId);
}
