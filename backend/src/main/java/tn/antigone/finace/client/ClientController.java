package tn.antigone.finace.client;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;
import tn.antigone.finace.payment.Payment;
import tn.antigone.finace.payment.PaymentRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/clients")
@RequiredArgsConstructor
@RequireFeature({ "invoice", "contacts", "payments" })
public class ClientController {

    private final ClientRepository repo;
    private final PaymentRepository paymentRepo;

    @GetMapping
    public List<Client> list(@RequestParam(defaultValue = "false") boolean includeDeleted) {
        return includeDeleted ? repo.findAll() : repo.findAllByDeletedAtIsNullOrderByNameAsc();
    }

    @GetMapping("/{id}")
    public Client get(@PathVariable UUID id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("Client introuvable"));
    }

    @PostMapping
    public Client create(@RequestBody Client in) {
        in.setId(null);
        in.setDeletedAt(null);
        return repo.save(in);
    }

    @PutMapping("/{id}")
    public Client update(@PathVariable UUID id, @RequestBody Client in) {
        Client existing = get(id);
        in.setId(existing.getId());
        in.setCreatedAt(existing.getCreatedAt());
        return repo.save(in);
    }

    /** Soft delete. */
    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        Client c = get(id);
        c.setDeletedAt(Instant.now());
        repo.save(c);
    }

    @PostMapping("/{id}/restore")
    public Client restore(@PathVariable UUID id) {
        Client c = get(id);
        c.setDeletedAt(null);
        return repo.save(c);
    }

    /** All payments (invoices) linked to a client. */
    @GetMapping("/{id}/payments")
    public List<Payment> payments(@PathVariable UUID id) {
        return paymentRepo.findAllByClientIdOrderByDateIssuedDesc(id);
    }
}
