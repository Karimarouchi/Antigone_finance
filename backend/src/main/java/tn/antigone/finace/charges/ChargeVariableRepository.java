package tn.antigone.finace.charges;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ChargeVariableRepository extends JpaRepository<ChargeVariable, UUID> {
    List<ChargeVariable> findAllByMoisOrderByDateAsc(String mois);
}
