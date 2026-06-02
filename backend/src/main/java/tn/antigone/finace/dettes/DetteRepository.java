package tn.antigone.finace.dettes;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DetteRepository extends JpaRepository<Dette, UUID> {
    List<Dette> findAllByArchivedAtIsNullOrderByDateEcheanceAsc();
}
