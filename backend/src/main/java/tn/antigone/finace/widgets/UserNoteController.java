package tn.antigone.finace.widgets;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.common.NotFoundException;
import tn.antigone.finace.security.SecurityUtils;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class UserNoteController {

    private final UserNoteRepository repo;

    @GetMapping
    public List<UserNote> list() {
        return repo.findAllByUserIdOrderByUpdatedAtDesc(SecurityUtils.currentUserId());
    }

    @PostMapping
    public UserNote create(@RequestBody UserNote in) {
        in.setId(null);
        in.setUserId(SecurityUtils.currentUserId());
        return repo.save(in);
    }

    @PutMapping("/{id}")
    public UserNote update(@PathVariable UUID id, @RequestBody UserNote in) {
        UserNote n = repo.findById(id).orElseThrow(() -> new NotFoundException("Note introuvable"));
        if (!n.getUserId().equals(SecurityUtils.currentUserId()))
            throw new NotFoundException("Note introuvable");
        if (in.getTitle() != null)   n.setTitle(in.getTitle());
        if (in.getContent() != null) n.setContent(in.getContent());
        return repo.save(n);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable UUID id) {
        UserNote n = repo.findById(id).orElseThrow(() -> new NotFoundException("Note introuvable"));
        if (!n.getUserId().equals(SecurityUtils.currentUserId()))
            throw new NotFoundException("Note introuvable");
        repo.deleteById(id);
    }
}
