package tn.antigone.finace.widgets;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface UserNoteRepository extends JpaRepository<UserNote, UUID> {
    List<UserNote> findAllByUserIdOrderByUpdatedAtDesc(UUID userId);
}
