package tn.antigone.finace.widgets;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.security.SecurityUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/calendar")
@RequiredArgsConstructor
public class CalendarEntryController {

    private final CalendarEntryRepository repo;

    @GetMapping
    public List<CalendarEntry> list(@RequestParam(required = false) LocalDate from,
                                    @RequestParam(required = false) LocalDate to) {
        UUID uid = SecurityUtils.currentUserId();
        if (from != null && to != null)
            return repo.findAllByUserIdAndDateBetweenOrderByDateAsc(uid, from, to);
        return repo.findAllByUserIdOrderByDateAsc(uid);
    }

    @PostMapping
    public CalendarEntry create(@RequestBody CalendarEntry in) {
        in.setId(null);
        in.setUserId(SecurityUtils.currentUserId());
        return repo.save(in);
    }

    @PutMapping("/{id}")
    public CalendarEntry update(@PathVariable UUID id, @RequestBody CalendarEntry in) {
        CalendarEntry e = repo.findById(id).orElseThrow(() -> new NotFoundException("Entrée introuvable"));
        if (!e.getUserId().equals(SecurityUtils.currentUserId()))
            throw new NotFoundException("Entrée introuvable");
        if (in.getTitle() != null) e.setTitle(in.getTitle());
        if (in.getNote()  != null) e.setNote(in.getNote());
        if (in.getColor() != null) e.setColor(in.getColor());
        if (in.getDate()  != null) e.setDate(in.getDate());
        return repo.save(e);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        CalendarEntry e = repo.findById(id).orElseThrow(() -> new NotFoundException("Entrée introuvable"));
        if (!e.getUserId().equals(SecurityUtils.currentUserId()))
            throw new NotFoundException("Entrée introuvable");
        repo.deleteById(id);
    }
}
