package tn.antigone.finace.payroll;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tn.antigone.finace.common.JsonNodeConverter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "employee_payroll_settings", uniqueConstraints = @UniqueConstraint(columnNames = { "employee_id",
        "effective_from" }))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EmployeePayrollSettings {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "employee_id", nullable = false)
    private UUID employeeId;
    @Column(name = "effective_from", nullable = false, length = 7)
    private String effectiveFrom;
    @Column(name = "salary_mode", nullable = false, length = 8)
    private String salaryMode = "base";

    @Convert(converter = JsonNodeConverter.class)
    @Column(columnDefinition = "jsonb")
    private JsonNode overrides;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
