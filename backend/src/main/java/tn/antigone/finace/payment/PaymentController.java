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
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@RequireFeature({ "payments", "invoice" })
public class PaymentController {

    private final PaymentRepository payments;
    private final PaymentPartialRepository partials;

    @GetMapping
    public List<Payment> list(@RequestParam(required = false) String status,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {
        if (status != null)
            return payments.findAllByStatus(status);
        if (from != null && to != null)
            return payments.findAllByDateIssuedBetween(from, to);
        return payments.findAllByOrderByDateIssuedDesc();
    }

    @GetMapping("/{id}")
    public Payment get(@PathVariable UUID id) {
        return payments.findById(id).orElseThrow(() -> new NotFoundException("Paiement introuvable"));
    }

    @PostMapping
    public Payment create(@RequestBody Payment in) {
        in.setId(null);
        return payments.save(in);
    }

    @PutMapping("/{id}")
    @Transactional
    public Payment update(@PathVariable UUID id, @RequestBody java.util.Map<String, Object> patch) {
        Payment p = get(id);
        if (patch.containsKey("status"))
            p.setStatus((String) patch.get("status"));
        if (patch.containsKey("invoice_number"))
            p.setInvoiceNumber((String) patch.get("invoice_number"));
        if (patch.containsKey("invoiceNumber"))
            p.setInvoiceNumber((String) patch.get("invoiceNumber"));
        if (patch.containsKey("client_name"))
            p.setClientName((String) patch.get("client_name"));
        if (patch.containsKey("clientName"))
            p.setClientName((String) patch.get("clientName"));
        if (patch.containsKey("notes"))
            p.setNotes((String) patch.get("notes"));
        if (patch.containsKey("pdf_key"))
            p.setPdfKey((String) patch.get("pdf_key"));
        if (patch.containsKey("pdfKey"))
            p.setPdfKey((String) patch.get("pdfKey"));

        java.util.function.Function<String, BigDecimal> num = k -> {
            Object v = patch.get(k);
            if (v == null)
                return null;
            if (v instanceof Number n)
                return new BigDecimal(n.toString());
            try {
                return new BigDecimal(v.toString());
            } catch (Exception e) {
                return null;
            }
        };
        if (patch.containsKey("total_ht")) {
            BigDecimal v = num.apply("total_ht");
            if (v != null)
                p.setTotalHt(v);
        }
        if (patch.containsKey("totalHt")) {
            BigDecimal v = num.apply("totalHt");
            if (v != null)
                p.setTotalHt(v);
        }
        if (patch.containsKey("total_tva")) {
            BigDecimal v = num.apply("total_tva");
            if (v != null)
                p.setTotalTva(v);
        }
        if (patch.containsKey("totalTva")) {
            BigDecimal v = num.apply("totalTva");
            if (v != null)
                p.setTotalTva(v);
        }
        if (patch.containsKey("total_ttc")) {
            BigDecimal v = num.apply("total_ttc");
            if (v != null)
                p.setTotalTtc(v);
        }
        if (patch.containsKey("totalTtc")) {
            BigDecimal v = num.apply("totalTtc");
            if (v != null)
                p.setTotalTtc(v);
        }
        if (patch.containsKey("amount_paid")) {
            BigDecimal v = num.apply("amount_paid");
            if (v != null)
                p.setAmountPaid(v);
        }
        if (patch.containsKey("amountPaid")) {
            BigDecimal v = num.apply("amountPaid");
            if (v != null)
                p.setAmountPaid(v);
        }

        java.util.function.Function<String, LocalDate> date = k -> {
            Object v = patch.get(k);
            if (v == null)
                return null;
            try {
                return LocalDate.parse(v.toString().substring(0, 10));
            } catch (Exception e) {
                return null;
            }
        };
        if (patch.containsKey("date_issued")) {
            LocalDate v = date.apply("date_issued");
            if (v != null)
                p.setDateIssued(v);
        }
        if (patch.containsKey("dateIssued")) {
            LocalDate v = date.apply("dateIssued");
            if (v != null)
                p.setDateIssued(v);
        }

        java.util.function.Function<String, Instant> inst = k -> {
            Object v = patch.get(k);
            if (v == null)
                return null;
            try {
                return Instant.parse(v.toString());
            } catch (Exception e) {
                return null;
            }
        };
        if (patch.containsKey("sent_at"))
            p.setSentAt(inst.apply("sent_at"));
        if (patch.containsKey("sentAt"))
            p.setSentAt(inst.apply("sentAt"));
        if (patch.containsKey("paid_at"))
            p.setPaidAt(inst.apply("paid_at"));
        if (patch.containsKey("paidAt"))
            p.setPaidAt(inst.apply("paidAt"));

        // Auto-derived: when status becomes "paid", stamp paidAt and
        // amountPaid=totalTtc if not provided
        if ("paid".equals(p.getStatus()) && p.getPaidAt() == null)
            p.setPaidAt(Instant.now());
        if ("paid".equals(p.getStatus()) && p.getTotalTtc() != null
                && (p.getAmountPaid() == null || p.getAmountPaid().compareTo(p.getTotalTtc()) < 0)) {
            p.setAmountPaid(p.getTotalTtc());
        }
        if ("pending".equals(p.getStatus()) && p.getSentAt() == null)
            p.setSentAt(Instant.now());

        return payments.save(p);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        payments.deleteById(id);
    }

    // ── Partial payments ────────────────────────────────────────────────────
    @GetMapping("/{id}/partials")
    public List<PaymentPartial> listPartials(@PathVariable("id") UUID paymentId) {
        return partials.findAllByPaymentIdOrderByDateAsc(paymentId);
    }

    @PostMapping("/{id}/partials")
    @Transactional
    public PaymentPartial addPartial(@PathVariable("id") UUID paymentId, @RequestBody PaymentPartial p) {
        Payment pay = get(paymentId);
        if (p.getMontant() == null || p.getMontant().signum() <= 0)
            throw new BadRequestException("Montant invalide");
        p.setId(null);
        p.setPaymentId(paymentId);
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

    @GetMapping("/exists")
    public java.util.Map<String, Boolean> exists(@RequestParam String num) {
        boolean found = payments.findFirstByInvoiceNumber(num).isPresent();
        return java.util.Map.of("exists", found);
    }

    @DeleteMapping("/partials/{partialId}")
    @Transactional
    public void deletePartial(@PathVariable UUID partialId) {
        PaymentPartial p = partials.findById(partialId)
                .orElseThrow(() -> new NotFoundException("Paiement partiel introuvable"));
        Payment pay = get(p.getPaymentId());
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
        partials.deleteById(partialId);
    }
}
