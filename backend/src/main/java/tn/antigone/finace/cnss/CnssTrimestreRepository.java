package tn.antigone.finace.cnss;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CnssTrimestreRepository extends JpaRepository<CnssTrimestre, UUID> {
    Optional<CnssTrimestre> findByAnneeAndTrimestre(Integer annee, Integer trimestre);
    List<CnssTrimestre> findAllByAnneeOrderByTrimestreAsc(Integer annee);
}
