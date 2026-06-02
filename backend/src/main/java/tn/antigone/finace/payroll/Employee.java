package tn.antigone.finace.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tn.antigone.finace.common.JsonNodeConverter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "employees")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class Employee {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String nom;
    @Column(nullable = false)
    private String prenom;
    private String cin;
    private String email;
    private String phone;
    private String poste;
    private String departement;

    @Column(name = "salaire_base", nullable = false)
    private BigDecimal salaireBase = BigDecimal.ZERO;
    @Column(name = "type_contrat", nullable = false)
    private String typeContrat = "CDI";

    // Legacy columns retained for backwards compatibility
    @Column(name = "date_embauche")
    private LocalDate dateEmbauche;
    @Column(name = "date_sortie")
    private LocalDate dateSortie;

    // Full identity (V10)
    @Column(name = "date_naissance")
    private LocalDate dateNaissance;
    @Column(name = "lieu_naissance")
    private String lieuNaissance;
    @Column(name = "situation_familiale")
    private String situationFamiliale;
    @Column(nullable = false)
    private Integer enfants = 0;

    // Contract dates (V10)
    @Column(name = "date_debut")
    private LocalDate dateDebut;
    @Column(name = "date_fin")
    private LocalDate dateFin;
    @Column(name = "date_retour")
    private LocalDate dateRetour;

    // CNSS / banking
    @Column(name = "numero_cnss")
    private String numeroCnss;
    @Column(name = "cnss_number")
    private String cnssNumber; // legacy mirror
    private String banque;
    private String rib;
    private String address;

    @Convert(converter = JsonNodeConverter.class)
    @Column(columnDefinition = "jsonb")
    private JsonNode gains;

    @Convert(converter = JsonNodeConverter.class)
    @Column(columnDefinition = "jsonb")
    private JsonNode retenues;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
