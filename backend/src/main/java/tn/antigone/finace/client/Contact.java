package tn.antigone.finace.client;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "contacts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Contact {
    @Id @GeneratedValue private UUID id;

    @Column(name = "client_id", nullable = false) private UUID clientId;
    @Column(name = "contact_name", nullable = false) private String contactName;
    @Column(name = "contact_role")  private String contactRole;
    @Column(name = "contact_email") private String contactEmail;
    @Column(name = "contact_phone") private String contactPhone;

    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(name = "updated_at")                     private Instant updatedAt;
}
