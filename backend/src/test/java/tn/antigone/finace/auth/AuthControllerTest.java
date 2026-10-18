package tn.antigone.finace.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tn.antigone.finace.common.BadRequestException;
import tn.antigone.finace.common.UnauthorizedException;
import tn.antigone.finace.config.AppProperties;
import tn.antigone.finace.config.CorsConfig;
import tn.antigone.finace.config.SecurityConfig;
import tn.antigone.finace.feature.FeatureService;
import tn.antigone.finace.security.JwtService;
import tn.antigone.finace.support.TestAuth;
import tn.antigone.finace.user.AppUser;
import tn.antigone.finace.user.AppUserRepository;
import tn.antigone.finace.user.Profile;
import tn.antigone.finace.user.ProfileRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@Import({ SecurityConfig.class, CorsConfig.class })
@EnableConfigurationProperties(AppProperties.class)
class AuthControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    @MockBean JwtService jwtService;
    @MockBean AuthService authService;
    @MockBean ProfileRepository profileRepo;
    @MockBean AppUserRepository userRepo;
    @MockBean FeatureService featureService;

    private final UUID userId = UUID.randomUUID();

    private AuthDtos.TokenPair pair() {
        return new AuthDtos.TokenPair("access", "refresh", 240,
                new AuthDtos.UserDto(userId, "jane@example.test", "Jane Doe", null, "user"));
    }

    @Test
    void loginIsPublicAndReturnsTokenPair() throws Exception {
        when(authService.login(new AuthDtos.LoginReq("jane@example.test", "secret123"))).thenReturn(pair());

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"jane@example.test\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", is("access")))
                .andExpect(jsonPath("$.refreshToken", is("refresh")))
                .andExpect(jsonPath("$.accessTtlMinutes", is(240)))
                .andExpect(jsonPath("$.user.email", is("jane@example.test")));
    }

    @Test
    void loginWithInvalidPayloadIsRejectedByValidation() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Validation failed")))
                .andExpect(jsonPath("$.fields.email", notNullValue()))
                .andExpect(jsonPath("$.fields.password", notNullValue()));
        verifyNoInteractions(authService);
    }

    @Test
    void loginWithWrongCredentialsReturns401WithMessage() throws Exception {
        when(authService.login(any())).thenThrow(new UnauthorizedException("Email ou mot de passe incorrect."));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"jane@example.test\",\"password\":\"wrong\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", is("Email ou mot de passe incorrect.")));
    }

    @Test
    void signupDelegatesToServiceAndReturnsTokenPair() throws Exception {
        AuthDtos.SignupReq req = new AuthDtos.SignupReq("Jane", "Doe", "jane@example.test", "secret123", "CODE42");
        when(authService.signup(req)).thenReturn(pair());

        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id", is(userId.toString())));
    }

    @Test
    void signupRejectsTooShortPassword() throws Exception {
        AuthDtos.SignupReq req = new AuthDtos.SignupReq("Jane", "Doe", "jane@example.test", "123", "CODE42");

        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.password", notNullValue()));
        verifyNoInteractions(authService);
    }

    @Test
    void signupBusinessErrorIsReturnedAs400() throws Exception {
        when(authService.signup(any())).thenThrow(new BadRequestException("Code d'invitation invalide."));
        AuthDtos.SignupReq req = new AuthDtos.SignupReq("Jane", "Doe", "jane@example.test", "secret123", "BAD");

        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", is("Code d'invitation invalide.")));
    }

    @Test
    void refreshPassesTokenToService() throws Exception {
        when(authService.refresh("old-refresh")).thenReturn(pair());

        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"old-refresh\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", is("access")));
    }

    @Test
    void logoutRevokesGivenRefreshToken() throws Exception {
        mvc.perform(post("/api/auth/logout").with(TestAuth.as(userId, "user"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"my-refresh\"}"))
                .andExpect(status().isOk());

        verify(authService).logout("my-refresh");
    }

    @Test
    void logoutWithoutBodyPassesNull() throws Exception {
        mvc.perform(post("/api/auth/logout").with(TestAuth.as(userId, "user")))
                .andExpect(status().isOk());

        verify(authService).logout(isNull());
    }

    @Test
    void meReturnsCurrentUserProfileAndFeatures() throws Exception {
        when(userRepo.findById(userId)).thenReturn(Optional.of(
                AppUser.builder().id(userId).email("jane@example.test").build()));
        when(profileRepo.findById(userId)).thenReturn(Optional.of(
                Profile.builder().id(userId).fullName("Jane Doe").avatarUrl("/a.png").role("admin").build()));
        when(featureService.listFeatures(userId)).thenReturn(List.of("clients", "invoice"));

        mvc.perform(get("/api/auth/me").with(TestAuth.as(userId, "admin")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id", is(userId.toString())))
                .andExpect(jsonPath("$.user.email", is("jane@example.test")))
                .andExpect(jsonPath("$.user.fullName", is("Jane Doe")))
                .andExpect(jsonPath("$.user.avatarUrl", is("/a.png")))
                .andExpect(jsonPath("$.user.role", is("admin")))
                .andExpect(jsonPath("$.features", containsInAnyOrder("clients", "invoice")));
    }

    @Test
    void meRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/auth/me"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(userRepo, profileRepo, featureService);
    }
}
