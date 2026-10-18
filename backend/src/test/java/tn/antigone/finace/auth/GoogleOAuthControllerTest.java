package tn.antigone.finace.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import tn.antigone.finace.common.UnauthorizedException;
import tn.antigone.finace.config.AppProperties;
import tn.antigone.finace.config.CorsConfig;
import tn.antigone.finace.config.SecurityConfig;
import tn.antigone.finace.security.JwtService;

import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(GoogleOAuthController.class)
@Import({ SecurityConfig.class, CorsConfig.class })
@EnableConfigurationProperties(AppProperties.class)
class GoogleOAuthControllerTest {

    @Autowired MockMvc mvc;

    @MockBean JwtService jwtService;
    @MockBean GoogleOAuthService googleService;

    @Test
    void googleLoginIsPublicAndReturnsTokenPairForIdToken() throws Exception {
        UUID id = UUID.randomUUID();
        when(googleService.loginOrCreate("fake-google-id-token")).thenReturn(new AuthDtos.TokenPair(
                "access", "refresh", 240,
                new AuthDtos.UserDto(id, "jane@example.test", "Jane", "https://example.test/p.png", "user")));

        mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\":\"fake-google-id-token\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", is("access")))
                .andExpect(jsonPath("$.user.id", is(id.toString())))
                .andExpect(jsonPath("$.user.avatarUrl", is("https://example.test/p.png")));

        verify(googleService).loginOrCreate("fake-google-id-token");
    }

    @Test
    void invalidGoogleTokenReturns401() throws Exception {
        when(googleService.loginOrCreate("bad-token")).thenThrow(new UnauthorizedException("Token Google invalide."));

        mvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\":\"bad-token\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message", is("Token Google invalide.")));
    }
}
