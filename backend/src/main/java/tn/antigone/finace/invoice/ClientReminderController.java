package tn.antigone.finace.invoice;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.feature.RequireFeature;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/client-reminders")
@RequiredArgsConstructor
@RequireFeature({"invoice"})
public class ClientReminderController {

    private final ClientReminderRepository repo;

    @GetMapping
    public List<ClientReminder> list() { return repo.findAll(); }

    @GetMapping("/{clientId}")
    public ClientReminder byClient(@PathVariable UUID clientId) {
        return repo.findByClientId(clientId).orElse(null);
    }

    @PostMapping
    public ClientReminder upsert(@RequestBody ClientReminder in) {
        ClientReminder existing = repo.findByClientId(in.getClientId()).orElse(null);
        if (existing != null) {
            in.setId(existing.getId());
            in.setCreatedAt(existing.getCreatedAt());
        }
        return repo.save(in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { repo.deleteById(id); }
}
