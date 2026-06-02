package tn.antigone.finace.widgets;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface CalendarEntryRepository extends JpaRepository<CalendarEntry, UUID> {
    List<CalendarEntry> findAllByUserIdAndDateBetweenOrderByDateAsc(UUID userId, LocalDate from, LocalDate to);
    List<CalendarEntry> findAllByUserIdOrderByDateAsc(UUID userId);
}
