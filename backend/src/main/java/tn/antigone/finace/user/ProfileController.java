package tn.antigone.finace.user;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.security.SecurityUtils;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final ProfileRepository repo;

    public record UpdateReq(String fullName, String email, String avatarUrl) {}

    @GetMapping
    public Profile getMyProfile() {
        return repo.findById(SecurityUtils.currentUserId()).orElseThrow();
    }

    @PatchMapping
    public Profile update(@Valid @RequestBody UpdateReq r) {
        Profile p = repo.findById(SecurityUtils.currentUserId()).orElseThrow();
        if (r.fullName() != null) p.setFullName(r.fullName());
        if (r.email()    != null) p.setEmail(r.email());
        if (r.avatarUrl() != null) p.setAvatarUrl(r.avatarUrl());
        return repo.save(p);
    }
}
