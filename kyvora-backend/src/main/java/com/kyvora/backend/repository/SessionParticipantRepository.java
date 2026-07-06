package com.kyvora.backend.repository;

import com.kyvora.backend.model.SessionParticipant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SessionParticipantRepository extends JpaRepository<SessionParticipant, Long> {
    List<SessionParticipant> findBySessionId(String sessionId);
    Optional<SessionParticipant> findBySessionIdAndUserId(String sessionId, Long userId);
    List<SessionParticipant> findByUserId(Long userId);
}
