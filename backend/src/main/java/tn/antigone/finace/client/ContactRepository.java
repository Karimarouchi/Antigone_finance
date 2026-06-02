package tn.antigone.finace.client;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ContactRepository extends JpaRepository<Contact, UUID> {
    List<Contact> findAllByClientIdOrderByContactNameAsc(UUID clientId);
}
