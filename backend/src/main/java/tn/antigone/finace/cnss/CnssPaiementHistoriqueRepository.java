package tn.antigone.finace.cnss;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CnssPaiementHistoriqueRepository extends JpaRepository<CnssPaiementHistorique, UUID> {
    List<CnssPaiementHistorique> findAllByAnneeAndTrimestreOrderByDatePaiementDesc(Integer annee, Integer trimestre);
}
