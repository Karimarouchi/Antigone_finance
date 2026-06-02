package tn.antigone.finace.invoice;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ServiceLibraryRepository extends JpaRepository<ServiceLibraryEntry, UUID> {
    List<ServiceLibraryEntry> findAllByCategoryIdOrderByNameAsc(String categoryId);
}
