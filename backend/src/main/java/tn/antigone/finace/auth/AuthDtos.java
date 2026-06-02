package tn.antigone.finace.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class AuthDtos {

    public record LoginReq(
            @NotBlank @Email String email,
            @NotBlank String password) {}

    public record SignupReq(
            @NotBlank String firstName,
            @NotBlank String lastName,
            @NotBlank @Email String email,
            @NotBlank @Size(min = 6) String password,
            @NotBlank String inviteCode) {}

    public record RefreshReq(@NotBlank String refreshToken) {}

    public record GoogleReq(@NotBlank String idToken, String inviteCode) {}

    public record TokenPair(
            String accessToken,
            String refreshToken,
            long accessTtlMinutes,
            UserDto user) {}

    public record UserDto(
            java.util.UUID id,
            String email,
            String fullName,
            String avatarUrl,
            String role) {}

    public record MeResponse(UserDto user, java.util.List<String> features) {}
}
