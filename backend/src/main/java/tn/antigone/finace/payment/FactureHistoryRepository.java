package tn.antigone.finace.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FactureHistoryRepository extends JpaRepository<FactureHistory, UUID> {
    List<FactureHistory> findAllByInvoiceNumberOrderByVersionDesc(String invoiceNumber);

    List<FactureHistory> findAllByOrderByCreatedAtDesc();

    java.util.Optional<FactureHistory> findFirstByInvoiceNumberAndVersion(String invoiceNumber, Integer version);
}
