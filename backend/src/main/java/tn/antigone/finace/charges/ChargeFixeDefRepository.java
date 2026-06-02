package tn.antigone.finace.charges;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChargeFixeDefRepository extends JpaRepository<ChargeFixeDef, UUID> {
    List<ChargeFixeDef> findAllByArchivedAtIsNull();
    List<ChargeFixeDef> findAllByGroupIdOrderByCreatedAtAsc(UUID groupId);
}
