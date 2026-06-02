package tn.antigone.finace.invoice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ClientReminderRepository extends JpaRepository<ClientReminder, UUID> {
    Optional<ClientReminder> findByClientId(UUID clientId);
}
