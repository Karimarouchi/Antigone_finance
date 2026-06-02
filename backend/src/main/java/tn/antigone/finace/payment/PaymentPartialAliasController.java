package tn.antigone.finace.payment;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/payment-partials")
@RequiredArgsConstructor
@RequireFeature({ "payments", "invoice", "encaissements-factures" })
public class PaymentPartialAliasController {

    private final PaymentPartialRepository partials;
    private final PaymentRepository payments;

    @GetMapping
    public List<PaymentPartial> list() {
        return partials.findAllByOrderByDateDesc();
    }

    @PostMapping
    @Transactional
    public PaymentPartial create(@RequestBody PaymentPartial p) {
        if (p.getPaymentId() == null)
            throw new BadRequestException("payment_id requis");
        if (p.getMontant() == null || p.getMontant().signum() <= 0)
            throw new BadRequestException("Montant invalide");
        Payment pay = payments.findById(p.getPaymentId())
                .orElseThrow(() -> new NotFoundException("Paiement introuvable"));
        p.setId(null);
        if (p.getDate() == null)
            p.setDate(LocalDate.now());
        if (p.getNote() == null)
            p.setNote("");
        PaymentPartial saved = partials.save(p);

        BigDecimal newAmount = (pay.getAmountPaid() == null ? BigDecimal.ZERO : pay.getAmountPaid())
                .add(p.getMontant());
        pay.setAmountPaid(newAmount);
        if (pay.getTotalTtc() != null && newAmount.compareTo(pay.getTotalTtc()) >= 0) {
            pay.setStatus("paid");
            pay.setPaidAt(Instant.now());
        } else if (newAmount.signum() > 0) {
            pay.setStatus("partial");
        }
        payments.save(pay);
        return saved;
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void delete(@PathVariable UUID id) {
        PaymentPartial p = partials.findById(id)
                .orElseThrow(() -> new NotFoundException("Paiement partiel introuvable"));
        Payment pay = payments.findById(p.getPaymentId()).orElse(null);
        if (pay != null) {
            BigDecimal newAmount = (pay.getAmountPaid() == null ? BigDecimal.ZERO : pay.getAmountPaid())
                    .subtract(p.getMontant());
            if (newAmount.signum() < 0)
                newAmount = BigDecimal.ZERO;
            pay.setAmountPaid(newAmount);
            if (newAmount.signum() == 0) {
                pay.setStatus("pending");
                pay.setPaidAt(null);
            } else if (pay.getTotalTtc() != null && newAmount.compareTo(pay.getTotalTtc()) < 0) {
                pay.setStatus("partial");
                pay.setPaidAt(null);
            }
            payments.save(pay);
        }
        partials.deleteById(id);
    }
}
