package tn.antigone.finace.invoice;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.feature.RequireFeature;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/services")
@RequiredArgsConstructor
@RequireFeature({"invoice"})
public class ServiceLibraryController {

    private final ServiceLibraryRepository repo;

    @GetMapping
    public List<ServiceLibraryEntry> list(@RequestParam(required = false) String categoryId) {
        return categoryId == null ? repo.findAll()
                : repo.findAllByCategoryIdOrderByNameAsc(categoryId);
    }

    @PostMapping
    public ServiceLibraryEntry create(@RequestBody ServiceLibraryEntry in) {
        in.setId(null);
        in.setCreatedAt(Instant.now());
        return repo.save(in);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) { repo.deleteById(id); }
}
