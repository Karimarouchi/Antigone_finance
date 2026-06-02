package tn.antigone.finace.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.*;
import lombok.*;
import tn.antigone.finace.common.JsonNodeConverter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "employee_contract_history", uniqueConstraints = @UniqueConstraint(columnNames = { "employee_id",
        "effective_from" }))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EmployeeContractHistory {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "employee_id", nullable = false)
    private UUID employeeId;
    @Column(name = "effective_from", nullable = false, length = 10)
    private String effectiveFrom;
    @Column(name = "salaire_base", nullable = false)
    private BigDecimal salaireBase;
    @Column(name = "type_contrat", nullable = false)
    private String typeContrat;
    private String poste;
    private String departement;
    @Column(columnDefinition = "text")
    private String note;
    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "salary_mode", nullable = false, length = 8)
    private String salaryMode = "base";

    @Convert(converter = JsonNodeConverter.class)
    @Column(name = "payroll_overrides", columnDefinition = "jsonb")
    private JsonNode payrollOverrides;
}
