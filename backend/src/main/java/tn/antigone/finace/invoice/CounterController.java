package tn.antigone.finace.invoice;

import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.feature.RequireFeature;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/counters")
@RequiredArgsConstructor
@RequireFeature({"invoice"})
public class CounterController {

    private final CounterRepository repo;

    @GetMapping
    public List<Counter> list() { return repo.findAll(); }

    @GetMapping("/{type}")
    public Counter get(@PathVariable String type) {
        return repo.findById(type).orElseThrow(() -> new NotFoundException("Counter introuvable"));
    }

    @PutMapping("/{type}")
    @Transactional
    public Counter update(@PathVariable String type, @RequestBody Map<String, String> body) {
        Counter c = repo.findById(type).orElse(Counter.builder().type(type).lastNumber("0000-0000").build());
        if (body.get("lastNumber") != null) c.setLastNumber(body.get("lastNumber"));
        c.setUpdatedAt(Instant.now());
        return repo.save(c);
    }
}
