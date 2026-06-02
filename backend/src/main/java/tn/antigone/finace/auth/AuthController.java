package tn.antigone.finace.auth;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.antigone.finace.feature.FeatureService;
import tn.antigone.finace.security.SecurityUtils;
import tn.antigone.finace.user.AppUserRepository;
import tn.antigone.finace.user.Profile;
import tn.antigone.finace.user.ProfileRepository;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService auth;
    private final ProfileRepository profileRepo;
    private final AppUserRepository userRepo;
    private final FeatureService featureService;

    @PostMapping("/signup")
    public AuthDtos.TokenPair signup(@Valid @RequestBody AuthDtos.SignupReq r) {
        return auth.signup(r);
    }

    @PostMapping("/login")
    public AuthDtos.TokenPair login(@Valid @RequestBody AuthDtos.LoginReq r) {
        return auth.login(r);
    }

    @PostMapping("/refresh")
    public AuthDtos.TokenPair refresh(@Valid @RequestBody AuthDtos.RefreshReq r) {
        return auth.refresh(r.refreshToken());
    }

    @PostMapping("/logout")
    public void logout(@RequestBody(required = false) AuthDtos.RefreshReq r) {
        auth.logout(r == null ? null : r.refreshToken());
    }

    @GetMapping("/me")
    public AuthDtos.MeResponse me() {
        var pid = SecurityUtils.currentUserId();
        var user = userRepo.findById(pid).orElseThrow();
        Profile p = profileRepo.findById(pid).orElseThrow();
        return new AuthDtos.MeResponse(
                new AuthDtos.UserDto(user.getId(), user.getEmail(),
                        p.getFullName(), p.getAvatarUrl(), p.getRole()),
                featureService.listFeatures(pid));
    }
}
