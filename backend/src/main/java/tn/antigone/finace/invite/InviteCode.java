package tn.antigone.finace.invite;

import jakarta.persistence.*;
import lombok.*;
import tn.antigone.finace.common.StringArrayConverter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "invite_codes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InviteCode {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true)
    private String code;

    private String label;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "used_by")
    private UUID usedBy;

    @Convert(converter = StringArrayConverter.class)
    @Column(columnDefinition = "text[]")
    private String[] features = new String[0];
}
