package tn.antigone.finace.client;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "clients")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Client {
    @Id @GeneratedValue private UUID id;

    @Column(nullable = false) private String name;
    @Column(name = "commercial_name")       private String commercialName;
    @Column(name = "matricule_fiscale")     private String matriculeFiscale;
    private String rne;
    private String industry;
    private String email;
    @Column(name = "email_receiver_name")   private String emailReceiverName;
    @Column(name = "email_receiver_gender") private String emailReceiverGender;
    private String country;
    private String city;
    private String address;
    @Column(name = "joining_date")          private LocalDate joiningDate;
    @Column(name = "billing_cycle")         private String billingCycle;
    @Column(name = "logo_url")              private String logoUrl;
    @Column(name = "deleted_at")            private Instant deletedAt;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(name = "updated_at")                     private Instant updatedAt;
}
