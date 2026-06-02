package tn.antigone.finace.invoice;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
@RequireFeature({"invoice"})
public class TemplateController {

    private final TemplateRepository repo;

    @GetMapping public List<Template> list() { return repo.findAll(); }

    @GetMapping("/{id}")
    public Template get(@PathVariable UUID id) {
        return repo.findById(id).orElseThrow(() -> new NotFoundException("Template introuvable"));
    }

    @PostMapping
    public Template create(@RequestBody Template in) {
        in.setId(null);
        return repo.save(in);
    }

    @PutMapping("/{id}")
    public Template update(@PathVariable UUID id, @RequestBody Template in) {
        Template existing = get(id);
        in.setId(existing.getId());
        in.setCreatedAt(existing.getCreatedAt());
        return repo.save(in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { repo.deleteById(id); }
}
