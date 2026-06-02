package tn.antigone.finace.invoice;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "client_reminders")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ClientReminder {
    @Id @GeneratedValue private UUID id;

    @Column(name = "client_id", nullable = false, unique = true) private UUID clientId;
    @Column(name = "next_payment_date", nullable = false)        private LocalDate nextPaymentDate;
    @Column(name = "reminder_10_days_shown", nullable = false)   private boolean reminder10DaysShown;
    @Column(name = "reminder_5_days_shown", nullable = false)    private boolean reminder5DaysShown;
    @Column(name = "reminder_1_day_shown", nullable = false)     private boolean reminder1DayShown;
    @Column(name = "confirmation_status")                         private String confirmationStatus;
    @Column(name = "last_denied_at")                              private Instant lastDeniedAt;
    @Column(name = "created_at")                                  private Instant createdAt;
}
