package tn.antigone.finace.feature;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_features",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "feature_id"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserFeature {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "feature_id", nullable = false)
    private String featureId;

    @Column(name = "granted_at")
    private Instant grantedAt;

    @Column(name = "granted_by")
    private UUID grantedBy;
}
