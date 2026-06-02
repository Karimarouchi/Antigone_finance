package tn.antigone.finace.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    List<Payment> findAllByOrderByDateIssuedDesc();

    List<Payment> findAllByStatus(String status);

    List<Payment> findAllByDateIssuedBetween(LocalDate from, LocalDate to);

    java.util.Optional<Payment> findFirstByInvoiceNumber(String invoiceNumber);

    List<Payment> findAllByClientIdOrderByDateIssuedDesc(UUID clientId);
}
