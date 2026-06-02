package tn.antigone.finace.client;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/contacts")
@RequiredArgsConstructor
@RequireFeature({"contacts", "invoice"})
public class ContactController {

    private final ContactRepository repo;

    @GetMapping
    public List<Contact> list(@RequestParam(required = false) UUID clientId) {
        if (clientId != null) return repo.findAllByClientIdOrderByContactNameAsc(clientId);
        return repo.findAll();
    }

    @PostMapping
    public Contact create(@RequestBody Contact in) {
        in.setId(null);
        return repo.save(in);
    }

    @PutMapping("/{id}")
    public Contact update(@PathVariable UUID id, @RequestBody Contact in) {
        Contact existing = repo.findById(id).orElseThrow(() -> new NotFoundException("Contact introuvable"));
        in.setId(existing.getId());
        in.setCreatedAt(existing.getCreatedAt());
        return repo.save(in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { repo.deleteById(id); }
}
