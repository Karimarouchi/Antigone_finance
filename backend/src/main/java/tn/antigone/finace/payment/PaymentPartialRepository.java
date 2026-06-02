package tn.antigone.finace.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PaymentPartialRepository extends JpaRepository<PaymentPartial, UUID> {
    List<PaymentPartial> findAllByPaymentIdOrderByDateAsc(UUID paymentId);

    List<PaymentPartial> findAllByOrderByDateDesc();
}
