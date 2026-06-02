package tn.antigone.finace.client;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ClientRepository extends JpaRepository<Client, UUID> {
    List<Client> findAllByDeletedAtIsNullOrderByNameAsc();
    List<Client> findAllByDeletedAtIsNotNull();
}
