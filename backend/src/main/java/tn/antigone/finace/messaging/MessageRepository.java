package tn.antigone.finace.messaging;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    @Query("""
        select m from Message m
        where m.deletedAt is null
          and ((m.senderId = :a and m.recipientId = :b)
            or (m.senderId = :b and m.recipientId = :a))
        order by m.createdAt asc
        """)
    List<Message> conversation(UUID a, UUID b);

    @Query("""
        select m from Message m
        where m.deletedAt is null
          and (m.senderId = :uid or m.recipientId = :uid)
        order by m.createdAt desc
        """)
    List<Message> inbox(UUID uid);

    long countByRecipientIdAndSeenAtIsNullAndDeletedAtIsNull(UUID recipientId);
}
