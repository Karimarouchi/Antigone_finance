package tn.antigone.finace.charges;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChargeFixePaiementRepository extends JpaRepository<ChargeFixePaiement, UUID> {
    List<ChargeFixePaiement> findAllByChargeIdOrderByMoisDesc(UUID chargeId);
    List<ChargeFixePaiement> findAllByMois(String mois);
}
